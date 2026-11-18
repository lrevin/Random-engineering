import type {WalletState} from './auth-client';
import type {QuizQuestion} from './quiz';
import type {Quest} from './quests';
export interface RewardStatus {
 day:string;daily:{topicId:string|null;done:boolean};bestStreak:number;
 recall:{topicId:string;last:string}[];premiumQuests:(Quest&{claimKey:string})[];premiumBonusKey:string;wallet:WalletState;
}
export interface ServerActivity {
 id:string;purpose:'study'|'recall'|'exam'|'review';status:'issued'|'completed'|'abandoned';topicId:string|null;certId:string|null;
 startedAt:string;studyEndedAt:string|null;completedAt:string|null;allowedSec:number;studySec:number;quizSec:number|null;paused:boolean;quizFixedAt?:string|null;
 items:{position:number;topicId:string;subject?:number;subjectName?:string;question:QuizQuestion}[];
 answers:(number|boolean|null)[];
 result:{score:number;total:number;pass?:boolean;subjects?:{name:string;score:number;total:number}[]}|null;
 wallet:WalletState;
}
