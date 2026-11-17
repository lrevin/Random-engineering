// 스터디 팀 (규칙 숫자는 team-policy.mjs)
// - 2~4명, 주제 상관없음. 한 사람은 한 팀에만, 나가기 전까지 계속 같은 팀
// - 꾸리기: 친구를 먼저 초대 → '빈자리 채우기'(모르는 사람을 받는 팀에 같이 들어가거나 새로 만듦) 또는 '친구끼리만'(수락한 친구가 1명 이상)
// - 팀이 있을 때도 빈자리가 있으면 친구를 초대할 수 있고, 수락하면 바로 들어옴
// - 주간 목표: 팀원 XP 합(팀에 들어온 뒤만)이 (150 × 인원) 이상이면, 들어온 뒤 XP를 50 이상 보탠 팀원마다 톱니바퀴 40 · XP 60을 한 번 받음
import {randomUUID,randomInt} from 'node:crypto';
import {connect,transaction} from '../server/db.mjs';
import {AuthError} from '../server/auth.mjs';
import {walletState} from './wallet-state.mjs';
import {TEAM_MIN,TEAM_MAX,TEAM_MODES,TEAM_REWARD,teamProgress,canClaimTeam,pickTeam,weekStartKst} from './team-policy.mjs';
const CODE=/^[A-Z0-9]{8}$/;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** 이번 주 XP (한국 월요일 0시와 팀에 들어온 때 중 늦은 때부터): 공부 · 스피드 퀴즈 · 오답 보스전. 팀 보상 XP는 목표 계산에서 뺌
 * 들어오기 전 XP는 세지 않음 (다 찬 팀에 늦게 들어와 보상만 받아 가는 것 방지) */
export const WEEK_XP_SQL=`(SELECT COALESCE(SUM(x.amount),0) FROM xp_ledger x WHERE x.user_id=m.user_id AND x.created_at>=GREATEST(?,m.joined_at))
 +(SELECT COALESCE(SUM(r.awarded_xp),0) FROM speed_runs r WHERE r.user_id=m.user_id AND r.status='completed' AND r.completed_at>=GREATEST(?,m.joined_at))
 +(SELECT COALESCE(SUM(b.reward_xp),0) FROM boss_runs b WHERE b.user_id=m.user_id AND b.status='cleared' AND b.finished_at>=GREATEST(?,m.joined_at))`;

export function createTeamService({auth,connectionFactory=connect,now=()=>new Date(),rand=randomInt}={}){
 async function member(header,action){
  const claims=await auth.verifyAccess(header),db=await connectionFactory();
  try{return await transaction(db,async()=>{const [[user]]=await db.execute('SELECT id,status,auth_version FROM users WHERE id=? FOR UPDATE',[claims.sub]);if(!user||user.status!=='active'||user.auth_version!==claims.av)throw new AuthError('unauthorized',401);return action(db,user.id);});}finally{await db.end();}
 }
 const week=()=>weekStartKst(now());
 /** 한국 월요일 0시 = UTC 전날 15시 */
 const weekSince=()=>new Date(new Date(week()+'T00:00:00Z').getTime()-9*3600e3);
 async function myTeam(db,id,lock=false){const [[t]]=await db.execute(`SELECT t.* FROM study_team_members m JOIN study_teams t ON t.id=m.team_id WHERE m.user_id=?${lock?' FOR UPDATE':''}`,[id]);return t??null;}
 async function areFriends(db,a,b){const [lo,hi]=a<b?[a,b]:[b,a];const [[f]]=await db.execute("SELECT 1 AS ok FROM social_friendships WHERE user_low=? AND user_high=? AND status='accepted'",[lo,hi]);return !!f;}
 async function members(db,team,me){
  const since=weekSince();
  const [rows]=await db.execute(`SELECT m.user_id,COALESCE(p.nickname,'학습자') AS nickname,s.friend_code AS uid,${WEEK_XP_SQL} AS week_xp,
    EXISTS(SELECT 1 FROM study_team_rewards w WHERE w.user_id=m.user_id AND w.week_start=?) AS claimed
   FROM study_team_members m LEFT JOIN profiles p ON p.user_id=m.user_id LEFT JOIN social_members s ON s.user_id=m.user_id
   WHERE m.team_id=? ORDER BY m.joined_at,m.user_id`,[since,since,since,week(),team.id]);
  return rows.map(r=>({nickname:r.nickname,uid:r.uid??null,me:r.user_id===me,leader:r.user_id===team.leader_id,weekXp:Math.max(0,Number(r.week_xp)),claimed:!!Number(r.claimed)}));
 }
 async function invites(db,id){
  const view=r=>({id:r.id,status:r.status,nickname:r.nickname,uid:r.uid??null});
  const [incoming]=await db.execute(`SELECT i.id,i.status,COALESCE(p.nickname,'학습자') AS nickname,s.friend_code AS uid FROM study_team_invites i
   LEFT JOIN profiles p ON p.user_id=i.leader_id LEFT JOIN social_members s ON s.user_id=i.leader_id
   WHERE i.invitee_id=? AND i.status IN ('pending','accepted') ORDER BY i.created_at`,[id]);
  const [outgoing]=await db.execute(`SELECT i.id,i.status,COALESCE(p.nickname,'학습자') AS nickname,s.friend_code AS uid FROM study_team_invites i
   LEFT JOIN profiles p ON p.user_id=i.invitee_id LEFT JOIN social_members s ON s.user_id=i.invitee_id
   WHERE i.leader_id=? AND i.status IN ('pending','accepted','declined') ORDER BY i.created_at`,[id]);
  return {incoming:incoming.map(view),outgoing:outgoing.map(view)};
 }
 async function status(db,id){
  const team=await myTeam(db,id),start=week(),end=new Date(start+'T00:00:00Z');end.setUTCDate(end.getUTCDate()+6);
  let view=null;
  if(team){
   const list=await members(db,team,id),progress=teamProgress(list),me=list.find(m=>m.me);
   view={id:team.id,mode:team.mode,leader:team.leader_id===id,members:list,progress,reward:TEAM_REWARD,canClaim:canClaimTeam(progress,me,me?.claimed)};
  }
  return {week:{start,end:end.toISOString().slice(0,10)},team:view,invites:await invites(db,id),rules:{min:TEAM_MIN,max:TEAM_MAX}};
 }
 /** 수락했지만 아직 팀에 안 들어간 친구 (내가 리더) */
 async function waitingFriends(db,id){
  const [acc]=await db.execute("SELECT id,invitee_id FROM study_team_invites WHERE leader_id=? AND status='accepted' FOR UPDATE",[id]);
  const out=[];for(const a of acc)if(!(await myTeam(db,a.invitee_id)))out.push(a);return out;
 }
 async function enter(db,team,people){
  for(const u of people)await db.execute('INSERT INTO study_team_members(team_id,user_id) VALUES (?,?)',[team.id,u]);
  await db.execute('UPDATE study_teams SET member_count=member_count+? WHERE id=?',[people.length,team.id]);
 }
 return {
  status:header=>member(header,(db,id)=>status(db,id)),
  /** 친구 초대 (UID 최대 3명 · 팀이 있으면 빈자리만큼) */
  invite:(header,body)=>member(header,async(db,id)=>{
   const codes=Array.isArray(body?.friendUids)?[...new Set(body.friendUids.map(c=>String(c).trim().toUpperCase()))]:null;
   if(!codes||!codes.length||codes.some(c=>!CODE.test(c)))throw new AuthError('invalid_request',400);
   const team=await myTeam(db,id,true);
   const [[open]]=await db.execute("SELECT COUNT(*) AS n FROM study_team_invites WHERE leader_id=? AND status IN ('pending','accepted')",[id]);
   const room=team?TEAM_MAX-Number(team.member_count):TEAM_MAX-1;
   if(Number(open.n)+codes.length>room)throw new AuthError('team_party_full',409);
   for(const code of codes){
    const [[f]]=await db.execute('SELECT user_id FROM social_members WHERE friend_code=?',[code]);
    if(!f||f.user_id===id||!(await areFriends(db,id,f.user_id)))throw new AuthError('not_friends',409);
    if(await myTeam(db,f.user_id))throw new AuthError('team_friend_joined',409);
    await db.execute(`INSERT INTO study_team_invites(id,leader_id,invitee_id,status) VALUES (?,?,?,'pending')
     ON DUPLICATE KEY UPDATE status='pending',created_at=CURRENT_TIMESTAMP(3),responded_at=NULL`,[randomUUID(),id,f.user_id]);
   }
   return status(db,id);
  }),
  /** 받은 초대 수락 · 거절, 보낸 초대 취소. 초대한 친구가 이미 팀이 있고 자리가 있으면 수락 즉시 그 팀으로 */
  respond:(header,inviteId,action)=>member(header,async(db,id)=>{
   if(!UUID.test(inviteId)||!['accept','decline','cancel'].includes(action))throw new AuthError('invalid_request',400);
   const [[inv]]=await db.execute('SELECT * FROM study_team_invites WHERE id=? FOR UPDATE',[inviteId]);
   const mine=action==='cancel'?inv?.leader_id===id:inv?.invitee_id===id;
   if(!inv||!mine)throw new AuthError('not_found',404);
   if(!['pending','accepted'].includes(inv.status))throw new AuthError('team_invite_closed',409);
   if(action!=='accept'){await db.execute('UPDATE study_team_invites SET status=?,responded_at=? WHERE id=?',[action==='decline'?'declined':'canceled',now(),inviteId]);return status(db,id);}
   if(await myTeam(db,id))throw new AuthError('team_already_joined',409);
   // 다른 사람 초대를 이미 수락했다면 그 초대는 거절로 (한 팀에만)
   await db.execute("UPDATE study_team_invites SET status='declined',responded_at=? WHERE invitee_id=? AND status='accepted' AND id<>?",[now(),id,inviteId]);
   const team=await myTeam(db,inv.leader_id,true);
   if(team){
    if(Number(team.member_count)>=TEAM_MAX)throw new AuthError('team_full',409);
    await enter(db,team,[id]);
    await db.execute("UPDATE study_team_invites SET status='used',responded_at=? WHERE id=?",[now(),inviteId]);
   }else await db.execute("UPDATE study_team_invites SET status='accepted',responded_at=? WHERE id=?",[now(),inviteId]);
   return status(db,id);
  }),
  /** 팀 꾸리기: mode 'open'(빈자리 채우기) · 'friends'(친구끼리만, 수락한 친구 1명 이상) */
  create:(header,body)=>member(header,async(db,id)=>{
   const mode=body?.mode;
   if(!TEAM_MODES.includes(mode))throw new AuthError('invalid_request',400);
   if(await myTeam(db,id))return status(db,id);
   const [[waiting]]=await db.execute("SELECT 1 AS ok FROM study_team_invites WHERE invitee_id=? AND status='accepted'",[id]);
   if(waiting)throw new AuthError('team_waiting_leader',409);
   const friends=await waitingFriends(db,id),people=[id,...friends.map(f=>f.invitee_id)];
   if(mode==='friends'&&people.length<TEAM_MIN)throw new AuthError('team_need_friend',409);
   let team=null;
   if(mode==='open'){
    const [open]=await db.execute("SELECT id,member_count FROM study_teams WHERE mode='open' AND member_count<=? FOR UPDATE",[TEAM_MAX-people.length]);
    team=pickTeam(open,people.length,rand);
   }
   if(!team){team={id:randomUUID()};await db.execute('INSERT INTO study_teams(id,mode,leader_id,member_count) VALUES (?,?,?,0)',[team.id,mode,id]);}
   await enter(db,team,people);
   if(friends.length)await db.execute(`UPDATE study_team_invites SET status='used' WHERE id IN (${friends.map(()=>'?').join(',')})`,friends.map(f=>f.id));
   await db.execute("UPDATE study_team_invites SET status='canceled' WHERE leader_id=? AND status='pending'",[id]);
   return status(db,id);
  }),
  /** 팀 나가기 (리더가 나가면 가장 먼저 들어온 사람이 리더, 아무도 없으면 팀 삭제) */
  leave:header=>member(header,async(db,id)=>{
   const team=await myTeam(db,id,true);if(!team)return status(db,id);
   await db.execute('DELETE FROM study_team_members WHERE user_id=?',[id]);
   const [[next]]=await db.execute('SELECT user_id FROM study_team_members WHERE team_id=? ORDER BY joined_at,user_id LIMIT 1',[team.id]);
   if(!next)await db.execute('DELETE FROM study_teams WHERE id=?',[team.id]);
   else await db.execute('UPDATE study_teams SET member_count=member_count-1,leader_id=? WHERE id=?',[team.leader_id===id?next.user_id:team.leader_id,team.id]);
   await db.execute("UPDATE study_team_invites SET status='canceled' WHERE leader_id=? AND status IN ('pending','accepted')",[id]);
   return status(db,id);
  }),
  /** 주간 목표 보상 받기 (한 주에 한 번) */
  claim:header=>member(header,async(db,id)=>{
   const team=await myTeam(db,id);if(!team)throw new AuthError('team_required',409);
   const list=await members(db,team,id),progress=teamProgress(list),me=list.find(m=>m.me);
   if(me?.claimed)throw new AuthError('team_reward_claimed',409);
   if(!canClaimTeam(progress,me,false))throw new AuthError(progress.done?'team_reward_no_xp':'team_goal_not_met',409);
   await db.execute('INSERT INTO study_team_rewards(user_id,week_start,team_id,reward_gears,reward_xp) VALUES (?,?,?,?,?)',[id,week(),team.id,TEAM_REWARD.gears,TEAM_REWARD.xp]);
   await walletState(db,id,now());
   await db.execute('UPDATE wallets SET balance=balance+? WHERE user_id=?',[TEAM_REWARD.gears,id]);
   await db.execute("INSERT INTO wallet_transactions(user_id,amount,reason,request_id) VALUES (?,?,'team_reward',?)",[id,TEAM_REWARD.gears,'team:'+week()]);
   return status(db,id);
  }),
 };
}
