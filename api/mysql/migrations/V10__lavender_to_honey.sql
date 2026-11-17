-- 라벤더 드림(skin:lavender, 1200) 판매 종료 → 같은 자리 · 같은 가격의 허니 레몬(skin:honey)으로 바꿔 줌
-- 1) 허니 레몬이 없는 사람: 라벤더 드림을 허니 레몬으로 (장착 상태 · 받은 경로 · 받은 때 그대로)
-- 2) 둘 다 가진 사람: 라벤더 드림 값 1200 톱니바퀴를 돌려주고, 라벤더 드림을 쓰고 있었으면 허니 레몬을 장착
-- 한 번만 돌아가는 Flyway 마이그레이션. 돌려준 기록은 wallet_transactions(reason='theme_refund', request_id='refund:lavender')

CREATE TEMPORARY TABLE lavender_both (user_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL PRIMARY KEY, equipped BOOLEAN NOT NULL);
INSERT INTO lavender_both(user_id,equipped)
 SELECT l.user_id,l.is_equipped FROM member_cosmetics l JOIN member_cosmetics h ON h.user_id=l.user_id AND h.item_type='skin' AND h.item_id='honey'
 WHERE l.item_type='skin' AND l.item_id='lavender';

-- 1) 허니 레몬이 없는 사람
UPDATE member_cosmetics SET item_id='honey'
 WHERE item_type='skin' AND item_id='lavender' AND user_id NOT IN (SELECT user_id FROM lavender_both);

-- 2) 둘 다 가진 사람: 라벤더 드림 지우고, 쓰고 있었으면 허니 레몬 장착
DELETE c FROM member_cosmetics c JOIN lavender_both b ON b.user_id=c.user_id WHERE c.item_type='skin' AND c.item_id='lavender';
UPDATE member_cosmetics c JOIN lavender_both b ON b.user_id=c.user_id AND b.equipped
 SET c.is_equipped=TRUE WHERE c.item_type='skin' AND c.item_id='honey';
INSERT INTO wallet_transactions(user_id,amount,reason,request_id)
 SELECT b.user_id,1200,'theme_refund','refund:lavender' FROM lavender_both b JOIN wallets w ON w.user_id=b.user_id;
UPDATE wallets w JOIN lavender_both b ON b.user_id=w.user_id SET w.balance=LEAST(999999,w.balance+1200);

DROP TEMPORARY TABLE lavender_both;
