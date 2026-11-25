-- 순천시 법정동 list: replace the SAMPLE regions with the verified official list (data only).
--
-- Until now the base seed loaded 33 SAMPLE 읍면동/리 rows (prisma/seed/regions.ts) whose
-- 10-digit codes were placeholders: right names, mostly WRONG numbers (조례동 = 1215011900, but
-- officially 1215011900 is 장천동 and 조례동 is 12150133; the 면 codes were shuffled). Listings
-- carry the official code (Kakao b_code), so e.g. a 조례동 listing (12150133) had no regions row
-- and the home page showed "12150133" as the region name.
--
-- This migration, in one transaction (the script runs as one implicit transaction):
--   1. loads the verified list (44 읍면동 with 8-digit codes + 163 리 with 10-digit codes,
--      apps/api/src/modules/complexes/regions/suncheon-regions.data.ts, checked against Kakao Local
--      on 2026-11-25) — only when the database already holds 순천시 (regions row 12150); an empty
--      database is left alone and gets the list from the base seed;
--   2. maps every other 순천시 regions row (sample codes, 10-digit "…00" 읍면동 rows) to the
--      verified code with the same NAME and level (a 리 also by its 읍면's name);
--   3. rewrites every stored region code: listings / properties / complexes / agencies /
--      deal_requests emd_code, deal_requests.region_codes, banner_target_regions, local_videos,
--      user_interest_regions.region_keys. A 10-digit 읍면동 code ("1215013300") becomes its
--      8-digit form ("12150133") everywhere;
--   4. repoints child rows and deletes the stale regions rows.
--
-- A stale code can mean two places: the sample row's name (codes picked from the region list —
-- banners, videos, 구하기 regions, 관심 지역) or the official 법정동 with that number (codes from
-- Kakao — properties, listings, complexes, agencies, 내놓기). For rows with an address/position
-- the 법정동 name in the 지번 address decides, then the nearer of the two places; otherwise the
-- column's source decides as above.
--
-- Idempotent: every statement only touches rows whose value changes, so a second run changes
-- nothing. Never touched: 중개사무소 등록번호 (e.g. 46150-2020-00012), free-text addresses,
-- audit logs, trade_records (they store 법정동 names, not codes).

-- 0. The verified list.
CREATE TEMP TABLE "_verified_regions" (
  "code" VARCHAR(10) PRIMARY KEY,
  "name" VARCHAR(50) NOT NULL,
  "level" "region_level" NOT NULL,
  "parent_code" VARCHAR(10) NOT NULL,
  "full_name" VARCHAR(200) NOT NULL,
  "lat" DOUBLE PRECISION NOT NULL,
  "lng" DOUBLE PRECISION NOT NULL,
  "sort_order" INTEGER NOT NULL
);

INSERT INTO "_verified_regions" ("code", "name", "level", "parent_code", "full_name", "lat", "lng", "sort_order") VALUES
  ('12150101', '삼거동', 'EMD', '12150', '전남광주통합특별시 순천시 삼거동', 34.986874, 127.423876, 0),
  ('12150102', '와룡동', 'EMD', '12150', '전남광주통합특별시 순천시 와룡동', 34.959152, 127.451749, 1),
  ('12150103', '영동', 'EMD', '12150', '전남광주통합특별시 순천시 영동', 34.954001, 127.482428, 2),
  ('12150104', '옥천동', 'EMD', '12150', '전남광주통합특별시 순천시 옥천동', 34.951993, 127.472147, 3),
  ('12150105', '행동', 'EMD', '12150', '전남광주통합특별시 순천시 행동', 34.955738, 127.482452, 4),
  ('12150106', '금곡동', 'EMD', '12150', '전남광주통합특별시 순천시 금곡동', 34.961393, 127.467397, 5),
  ('12150107', '매곡동', 'EMD', '12150', '전남광주통합특별시 순천시 매곡동', 34.964091, 127.482763, 6),
  ('12150108', '석현동', 'EMD', '12150', '전남광주통합특별시 순천시 석현동', 34.984874, 127.455588, 7),
  ('12150109', '가곡동', 'EMD', '12150', '전남광주통합특별시 순천시 가곡동', 34.98461, 127.479037, 8),
  ('12150110', '용당동', 'EMD', '12150', '전남광주통합특별시 순천시 용당동', 34.970791, 127.497756, 9),
  ('12150111', '조곡동', 'EMD', '12150', '전남광주통합특별시 순천시 조곡동', 34.950081, 127.498559, 10),
  ('12150112', '생목동', 'EMD', '12150', '전남광주통합특별시 순천시 생목동', 34.953773, 127.508115, 11),
  ('12150113', '덕암동', 'EMD', '12150', '전남광주통합특별시 순천시 덕암동', 34.945869, 127.50667, 12),
  ('12150114', '연향동', 'EMD', '12150', '전남광주통합특별시 순천시 연향동', 34.939582, 127.521019, 13),
  ('12150115', '풍덕동', 'EMD', '12150', '전남광주통합특별시 순천시 풍덕동', 34.941855, 127.497301, 14),
  ('12150116', '남정동', 'EMD', '12150', '전남광주통합특별시 순천시 남정동', 34.93977, 127.484245, 15),
  ('12150117', '인제동', 'EMD', '12150', '전남광주통합특별시 순천시 인제동', 34.942232, 127.476045, 16),
  ('12150118', '저전동', 'EMD', '12150', '전남광주통합특별시 순천시 저전동', 34.948135, 127.484084, 17),
  ('12150119', '장천동', 'EMD', '12150', '전남광주통합특별시 순천시 장천동', 34.948474, 127.48677, 18),
  ('12150120', '남내동', 'EMD', '12150', '전남광주통합특별시 순천시 남내동', 34.954018, 127.485209, 19),
  ('12150121', '중앙동', 'EMD', '12150', '전남광주통합특별시 순천시 중앙동', 34.956057, 127.484897, 20),
  ('12150122', '동외동', 'EMD', '12150', '전남광주통합특별시 순천시 동외동', 34.957023, 127.487671, 21),
  ('12150123', '교량동', 'EMD', '12150', '전남광주통합특별시 순천시 교량동', 34.903583, 127.512813, 22),
  ('12150124', '대룡동', 'EMD', '12150', '전남광주통합특별시 순천시 대룡동', 34.905964, 127.490572, 23),
  ('12150125', '홍내동', 'EMD', '12150', '전남광주통합특별시 순천시 홍내동', 34.916316, 127.509683, 24),
  ('12150126', '오천동', 'EMD', '12150', '전남광주통합특별시 순천시 오천동', 34.927938, 127.497287, 25),
  ('12150127', '덕월동', 'EMD', '12150', '전남광주통합특별시 순천시 덕월동', 34.927552, 127.479222, 26),
  ('12150128', '야흥동', 'EMD', '12150', '전남광주통합특별시 순천시 야흥동', 34.913049, 127.480762, 27),
  ('12150129', '인월동', 'EMD', '12150', '전남광주통합특별시 순천시 인월동', 34.891564, 127.48142, 28),
  ('12150130', '안풍동', 'EMD', '12150', '전남광주통합특별시 순천시 안풍동', 34.887617, 127.494607, 29),
  ('12150131', '대대동', 'EMD', '12150', '전남광주통합특별시 순천시 대대동', 34.890784, 127.510025, 30),
  ('12150132', '왕지동', 'EMD', '12150', '전남광주통합특별시 순천시 왕지동', 34.975169, 127.538021, 31),
  ('12150133', '조례동', 'EMD', '12150', '전남광주통합특별시 순천시 조례동', 34.961766, 127.523528, 32),
  ('12150250', '승주읍', 'EMD', '12150', '전남광주통합특별시 순천시 승주읍', 35.014426, 127.389866, 33),
  ('1215025021', '두월리', 'RI', '12150250', '전남광주통합특별시 순천시 승주읍 두월리', 35.03908, 127.325059, 34),
  ('1215025022', '신전리', 'RI', '12150250', '전남광주통합특별시 순천시 승주읍 신전리', 35.017844, 127.330462, 35),
  ('1215025023', '유흥리', 'RI', '12150250', '전남광주통합특별시 순천시 승주읍 유흥리', 35.0522, 127.338471, 36),
  ('1215025024', '봉덕리', 'RI', '12150250', '전남광주통합특별시 순천시 승주읍 봉덕리', 35.021938, 127.355365, 37),
  ('1215025025', '평중리', 'RI', '12150250', '전남광주통합특별시 순천시 승주읍 평중리', 35.022383, 127.370417, 38),
  ('1215025026', '구강리', 'RI', '12150250', '전남광주통합특별시 순천시 승주읍 구강리', 35.034001, 127.37822, 39),
  ('1215025027', '도정리', 'RI', '12150250', '전남광주통합특별시 순천시 승주읍 도정리', 35.055288, 127.366589, 40),
  ('1215025028', '월계리', 'RI', '12150250', '전남광주통합특별시 순천시 승주읍 월계리', 35.022866, 127.407701, 41),
  ('1215025029', '서평리', 'RI', '12150250', '전남광주통합특별시 순천시 승주읍 서평리', 35.018451, 127.389421, 42),
  ('1215025030', '신성리', 'RI', '12150250', '전남광주통합특별시 순천시 승주읍 신성리', 35.002476, 127.392592, 43),
  ('1215025031', '신학리', 'RI', '12150250', '전남광주통합특별시 순천시 승주읍 신학리', 35.000799, 127.362442, 44),
  ('1215025032', '죽학리', 'RI', '12150250', '전남광주통합특별시 순천시 승주읍 죽학리', 34.992635, 127.33798, 45),
  ('1215025033', '유평리', 'RI', '12150250', '전남광주통합특별시 순천시 승주읍 유평리', 34.986949, 127.379668, 46),
  ('1215025034', '남강리', 'RI', '12150250', '전남광주통합특별시 순천시 승주읍 남강리', 34.972311, 127.356937, 47),
  ('12150310', '해룡면', 'EMD', '12150', '전남광주통합특별시 순천시 해룡면', 34.913722, 127.537707, 48),
  ('1215031021', '복성리', 'RI', '12150310', '전남광주통합특별시 순천시 해룡면 복성리', 34.954538, 127.547152, 49),
  ('1215031022', '신대리', 'RI', '12150310', '전남광주통합특별시 순천시 해룡면 신대리', 34.933343, 127.560128, 50),
  ('1215031023', '상삼리', 'RI', '12150310', '전남광주통합특별시 순천시 해룡면 상삼리', 34.942299, 127.537705, 51),
  ('1215031024', '대안리', 'RI', '12150310', '전남광주통합특별시 순천시 해룡면 대안리', 34.918542, 127.524659, 52),
  ('1215031025', '남가리', 'RI', '12150310', '전남광주통합특별시 순천시 해룡면 남가리', 34.929187, 127.539042, 53),
  ('1215031026', '월전리', 'RI', '12150310', '전남광주통합특별시 순천시 해룡면 월전리', 34.911542, 127.535084, 54),
  ('1215031027', '성산리', 'RI', '12150310', '전남광주통합특별시 순천시 해룡면 성산리', 34.914497, 127.549018, 55),
  ('1215031028', '선월리', 'RI', '12150310', '전남광주통합특별시 순천시 해룡면 선월리', 34.9105, 127.560507, 56),
  ('1215031029', '신성리', 'RI', '12150310', '전남광주통합특별시 순천시 해룡면 신성리', 34.906896, 127.581657, 57),
  ('1215031030', '호두리', 'RI', '12150310', '전남광주통합특별시 순천시 해룡면 호두리', 34.896885, 127.566077, 58),
  ('1215031031', '용전리', 'RI', '12150310', '전남광주통합특별시 순천시 해룡면 용전리', 34.894155, 127.549754, 59),
  ('1215031032', '도롱리', 'RI', '12150310', '전남광주통합특별시 순천시 해룡면 도롱리', 34.902771, 127.533863, 60),
  ('1215031033', '중흥리', 'RI', '12150310', '전남광주통합특별시 순천시 해룡면 중흥리', 34.897053, 127.534522, 61),
  ('1215031034', '해창리', 'RI', '12150310', '전남광주통합특별시 순천시 해룡면 해창리', 34.890525, 127.533311, 62),
  ('1215031035', '선학리', 'RI', '12150310', '전남광주통합특별시 순천시 해룡면 선학리', 34.877715, 127.526692, 63),
  ('1215031036', '농주리', 'RI', '12150310', '전남광주통합특별시 순천시 해룡면 농주리', 34.86459, 127.527789, 64),
  ('1215031037', '상내리', 'RI', '12150310', '전남광주통합특별시 순천시 해룡면 상내리', 34.848014, 127.534476, 65),
  ('1215031038', '하사리', 'RI', '12150310', '전남광주통합특별시 순천시 해룡면 하사리', 34.859883, 127.543734, 66),
  ('12150320', '서면', 'EMD', '12150', '전남광주통합특별시 순천시 서면', 34.994719, 127.488354, 67),
  ('1215032021', '학구리', 'RI', '12150320', '전남광주통합특별시 순천시 서면 학구리', 35.042523, 127.437697, 68),
  ('1215032022', '대구리', 'RI', '12150320', '전남광주통합특별시 순천시 서면 대구리', 35.032429, 127.424147, 69),
  ('1215032023', '구만리', 'RI', '12150320', '전남광주통합특별시 순천시 서면 구만리', 35.029759, 127.453623, 70),
  ('1215032024', '비월리', 'RI', '12150320', '전남광주통합특별시 순천시 서면 비월리', 35.010724, 127.448233, 71),
  ('1215032025', '동산리', 'RI', '12150320', '전남광주통합특별시 순천시 서면 동산리', 35.001283, 127.472514, 72),
  ('1215032026', '운평리', 'RI', '12150320', '전남광주통합특별시 순천시 서면 운평리', 35.029189, 127.476146, 73),
  ('1215032027', '죽평리', 'RI', '12150320', '전남광주통합특별시 순천시 서면 죽평리', 35.003572, 127.492569, 74),
  ('1215032028', '선평리', 'RI', '12150320', '전남광주통합특별시 순천시 서면 선평리', 34.987937, 127.499932, 75),
  ('1215032029', '압곡리', 'RI', '12150320', '전남광주통합특별시 순천시 서면 압곡리', 34.995393, 127.528133, 76),
  ('1215032030', '구상리', 'RI', '12150320', '전남광주통합특별시 순천시 서면 구상리', 35.014716, 127.542425, 77),
  ('1215032031', '흥대리', 'RI', '12150320', '전남광주통합특별시 순천시 서면 흥대리', 35.020833, 127.554856, 78),
  ('1215032032', '지본리', 'RI', '12150320', '전남광주통합특별시 순천시 서면 지본리', 35.002524, 127.509692, 79),
  ('1215032033', '판교리', 'RI', '12150320', '전남광주통합특별시 순천시 서면 판교리', 35.028974, 127.510448, 80),
  ('1215032034', '청소리', 'RI', '12150320', '전남광주통합특별시 순천시 서면 청소리', 35.063283, 127.506267, 81),
  ('12150330', '황전면', 'EMD', '12150', '전남광주통합특별시 순천시 황전면', 35.101366, 127.427013, 82),
  ('1215033021', '죽청리', 'RI', '12150330', '전남광주통합특별시 순천시 황전면 죽청리', 35.07259, 127.453952, 83),
  ('1215033022', '평촌리', 'RI', '12150330', '전남광주통합특별시 순천시 황전면 평촌리', 35.082762, 127.478211, 84),
  ('1215033023', '수평리', 'RI', '12150330', '전남광주통합특별시 순천시 황전면 수평리', 35.097329, 127.438718, 85),
  ('1215033024', '괴목리', 'RI', '12150330', '전남광주통합특별시 순천시 황전면 괴목리', 35.092762, 127.422261, 86),
  ('1215033025', '죽내리', 'RI', '12150330', '전남광주통합특별시 순천시 황전면 죽내리', 35.123647, 127.418831, 87),
  ('1215033026', '황학리', 'RI', '12150330', '전남광주통합특별시 순천시 황전면 황학리', 35.104408, 127.45509, 88),
  ('1215033027', '월산리', 'RI', '12150330', '전남광주통합특별시 순천시 황전면 월산리', 35.122285, 127.437961, 89),
  ('1215033028', '내구리', 'RI', '12150330', '전남광주통합특별시 순천시 황전면 내구리', 35.122602, 127.456718, 90),
  ('1215033029', '봉덕리', 'RI', '12150330', '전남광주통합특별시 순천시 황전면 봉덕리', 35.14039, 127.431456, 91),
  ('1215033030', '선변리', 'RI', '12150330', '전남광주통합특별시 순천시 황전면 선변리', 35.148637, 127.454563, 92),
  ('1215033031', '비촌리', 'RI', '12150330', '전남광주통합특별시 순천시 황전면 비촌리', 35.168442, 127.428689, 93),
  ('1215033032', '금평리', 'RI', '12150330', '전남광주통합특별시 순천시 황전면 금평리', 35.143839, 127.474104, 94),
  ('1215033033', '대치리', 'RI', '12150330', '전남광주통합특별시 순천시 황전면 대치리', 35.130082, 127.48493, 95),
  ('1215033034', '모전리', 'RI', '12150330', '전남광주통합특별시 순천시 황전면 모전리', 35.111359, 127.474855, 96),
  ('1215033035', '회룡리', 'RI', '12150330', '전남광주통합특별시 순천시 황전면 회룡리', 35.107668, 127.487294, 97),
  ('1215033036', '덕림리', 'RI', '12150330', '전남광주통합특별시 순천시 황전면 덕림리', 35.101202, 127.513841, 98),
  ('12150340', '월등면', 'EMD', '12150', '전남광주통합특별시 순천시 월등면', 35.093401, 127.380538, 99),
  ('1215034021', '대평리', 'RI', '12150340', '전남광주통합특별시 순천시 월등면 대평리', 35.097827, 127.378707, 100),
  ('1215034022', '농선리', 'RI', '12150340', '전남광주통합특별시 순천시 월등면 농선리', 35.104708, 127.41683, 101),
  ('1215034023', '월용리', 'RI', '12150340', '전남광주통합특별시 순천시 월등면 월용리', 35.113899, 127.396092, 102),
  ('1215034024', '신월리', 'RI', '12150340', '전남광주통합특별시 순천시 월등면 신월리', 35.089974, 127.353993, 103),
  ('1215034025', '운월리', 'RI', '12150340', '전남광주통합특별시 순천시 월등면 운월리', 35.076472, 127.34982, 104),
  ('1215034026', '갈평리', 'RI', '12150340', '전남광주통합특별시 순천시 월등면 갈평리', 35.07931, 127.370587, 105),
  ('1215034027', '송천리', 'RI', '12150340', '전남광주통합특별시 순천시 월등면 송천리', 35.082609, 127.384335, 106),
  ('1215034028', '망용리', 'RI', '12150340', '전남광주통합특별시 순천시 월등면 망용리', 35.080425, 127.407382, 107),
  ('1215034029', '계월리', 'RI', '12150340', '전남광주통합특별시 순천시 월등면 계월리', 35.065262, 127.414103, 108),
  ('1215034030', '월림리', 'RI', '12150340', '전남광주통합특별시 순천시 월등면 월림리', 35.077291, 127.393345, 109),
  ('12150350', '주암면', 'EMD', '12150', '전남광주통합특별시 순천시 주암면', 35.076789, 127.235071, 110),
  ('1215035021', '행정리', 'RI', '12150350', '전남광주통합특별시 순천시 주암면 행정리', 35.030488, 127.301408, 111),
  ('1215035022', '갈마리', 'RI', '12150350', '전남광주통합특별시 순천시 주암면 갈마리', 35.057803, 127.2928, 112),
  ('1215035023', '주암리', 'RI', '12150350', '전남광주통합특별시 순천시 주암면 주암리', 35.064884, 127.305998, 113),
  ('1215035024', '오산리', 'RI', '12150350', '전남광주통합특별시 순천시 주암면 오산리', 35.0744, 127.286285, 114),
  ('1215035025', '창촌리', 'RI', '12150350', '전남광주통합특별시 순천시 주암면 창촌리', 35.05623, 127.283955, 115),
  ('1215035026', '복다리', 'RI', '12150350', '전남광주통합특별시 순천시 주암면 복다리', 35.044398, 127.282116, 116),
  ('1215035028', '요곡리', 'RI', '12150350', '전남광주통합특별시 순천시 주암면 요곡리', 35.061961, 127.262413, 117),
  ('1215035029', '구산리', 'RI', '12150350', '전남광주통합특별시 순천시 주암면 구산리', 35.070155, 127.245771, 118),
  ('1215035030', '죽림리', 'RI', '12150350', '전남광주통합특별시 순천시 주암면 죽림리', 35.075821, 127.252178, 119),
  ('1215035031', '고산리', 'RI', '12150350', '전남광주통합특별시 순천시 주암면 고산리', 35.081366, 127.265818, 120),
  ('1215035032', '대광리', 'RI', '12150350', '전남광주통합특별시 순천시 주암면 대광리', 35.051073, 127.220323, 121),
  ('1215035033', '광천리', 'RI', '12150350', '전남광주통합특별시 순천시 주암면 광천리', 35.07493, 127.226676, 122),
  ('1215035034', '비룡리', 'RI', '12150350', '전남광주통합특별시 순천시 주암면 비룡리', 35.07882, 127.200358, 123),
  ('1215035035', '한곡리', 'RI', '12150350', '전남광주통합특별시 순천시 주암면 한곡리', 35.088014, 127.232735, 124),
  ('1215035036', '어왕리', 'RI', '12150350', '전남광주통합특별시 순천시 주암면 어왕리', 35.091356, 127.223024, 125),
  ('1215035037', '백록리', 'RI', '12150350', '전남광주통합특별시 순천시 주암면 백록리', 35.107409, 127.220422, 126),
  ('1215035038', '대구리', 'RI', '12150350', '전남광주통합특별시 순천시 주암면 대구리', 35.104853, 127.237139, 127),
  ('1215035039', '궁각리', 'RI', '12150350', '전남광주통합특별시 순천시 주암면 궁각리', 35.09471, 127.252065, 128),
  ('1215035040', '운룡리', 'RI', '12150350', '전남광주통합특별시 순천시 주암면 운룡리', 35.106145, 127.198372, 129),
  ('1215035041', '문길리', 'RI', '12150350', '전남광주통합특별시 순천시 주암면 문길리', 35.046476, 127.267002, 130),
  ('12150360', '송광면', 'EMD', '12150', '전남광주통합특별시 순천시 송광면', 34.974081, 127.263841, 131),
  ('1215036021', '오봉리', 'RI', '12150360', '전남광주통합특별시 순천시 송광면 오봉리', 35.034139, 127.251523, 132),
  ('1215036022', '신흥리', 'RI', '12150360', '전남광주통합특별시 순천시 송광면 신흥리', 35.020097, 127.274284, 133),
  ('1215036023', '신평리', 'RI', '12150360', '전남광주통합특별시 순천시 송광면 신평리', 35.001863, 127.266564, 134),
  ('1215036024', '낙수리', 'RI', '12150360', '전남광주통합특별시 순천시 송광면 낙수리', 35.027285, 127.239195, 135),
  ('1215036025', '삼청리', 'RI', '12150360', '전남광주통합특별시 순천시 송광면 삼청리', 35.028487, 127.206845, 136),
  ('1215036026', '후곡리', 'RI', '12150360', '전남광주통합특별시 순천시 송광면 후곡리', 35.011223, 127.209607, 137),
  ('1215036027', '월산리', 'RI', '12150360', '전남광주통합특별시 순천시 송광면 월산리', 34.990832, 127.195333, 138),
  ('1215036028', '대곡리', 'RI', '12150360', '전남광주통합특별시 순천시 송광면 대곡리', 34.998552, 127.232083, 139),
  ('1215036029', '우산리', 'RI', '12150360', '전남광주통합특별시 순천시 송광면 우산리', 34.964966, 127.222681, 140),
  ('1215036030', '덕산리', 'RI', '12150360', '전남광주통합특별시 순천시 송광면 덕산리', 34.971996, 127.245429, 141),
  ('1215036031', '봉산리', 'RI', '12150360', '전남광주통합특별시 순천시 송광면 봉산리', 34.987475, 127.259192, 142),
  ('1215036032', '이읍리', 'RI', '12150360', '전남광주통합특별시 순천시 송광면 이읍리', 34.973379, 127.269787, 143),
  ('1215036033', '장안리', 'RI', '12150360', '전남광주통합특별시 순천시 송광면 장안리', 34.975836, 127.299893, 144),
  ('1215036034', '구룡리', 'RI', '12150360', '전남광주통합특별시 순천시 송광면 구룡리', 34.947624, 127.258681, 145),
  ('1215036035', '대흥리', 'RI', '12150360', '전남광주통합특별시 순천시 송광면 대흥리', 34.934498, 127.252703, 146),
  ('12150370', '외서면', 'EMD', '12150', '전남광주통합특별시 순천시 외서면', 34.913715, 127.277401, 147),
  ('1215037021', '신덕리', 'RI', '12150370', '전남광주통합특별시 순천시 외서면 신덕리', 34.914361, 127.297218, 148),
  ('1215037022', '쌍율리', 'RI', '12150370', '전남광주통합특별시 순천시 외서면 쌍율리', 34.936698, 127.295386, 149),
  ('1215037023', '금성리', 'RI', '12150370', '전남광주통합특별시 순천시 외서면 금성리', 34.937455, 127.275309, 150),
  ('1215037024', '월암리', 'RI', '12150370', '전남광주통합특별시 순천시 외서면 월암리', 34.916367, 127.268795, 151),
  ('1215037025', '도신리', 'RI', '12150370', '전남광주통합특별시 순천시 외서면 도신리', 34.909646, 127.248421, 152),
  ('1215037026', '반용리', 'RI', '12150370', '전남광주통합특별시 순천시 외서면 반용리', 34.897489, 127.244192, 153),
  ('1215037027', '화전리', 'RI', '12150370', '전남광주통합특별시 순천시 외서면 화전리', 34.908906, 127.277363, 154),
  ('1215037028', '장산리', 'RI', '12150370', '전남광주통합특별시 순천시 외서면 장산리', 34.89952, 127.280824, 155),
  ('12150380', '낙안면', 'EMD', '12150', '전남광주통합특별시 순천시 낙안면', 34.908062, 127.346251, 156),
  ('1215038021', '동내리', 'RI', '12150380', '전남광주통합특별시 순천시 낙안면 동내리', 34.914048, 127.355836, 157),
  ('1215038022', '남내리', 'RI', '12150380', '전남광주통합특별시 순천시 낙안면 남내리', 34.901772, 127.334049, 158),
  ('1215038023', '서내리', 'RI', '12150380', '전남광주통합특별시 순천시 낙안면 서내리', 34.914991, 127.340143, 159),
  ('1215038024', '성북리', 'RI', '12150380', '전남광주통합특별시 순천시 낙안면 성북리', 34.915809, 127.34522, 160),
  ('1215038025', '상송리', 'RI', '12150380', '전남광주통합특별시 순천시 낙안면 상송리', 34.920785, 127.336118, 161),
  ('1215038026', '하송리', 'RI', '12150380', '전남광주통합특별시 순천시 낙안면 하송리', 34.917353, 127.320105, 162),
  ('1215038027', '검암리', 'RI', '12150380', '전남광주통합특별시 순천시 낙안면 검암리', 34.900634, 127.319957, 163),
  ('1215038028', '옥산리', 'RI', '12150380', '전남광주통합특별시 순천시 낙안면 옥산리', 34.89094, 127.326146, 164),
  ('1215038029', '평촌리', 'RI', '12150380', '전남광주통합특별시 순천시 낙안면 평촌리', 34.897452, 127.339458, 165),
  ('1215038030', '교촌리', 'RI', '12150380', '전남광주통합특별시 순천시 낙안면 교촌리', 34.896285, 127.345506, 166),
  ('1215038031', '신기리', 'RI', '12150380', '전남광주통합특별시 순천시 낙안면 신기리', 34.871508, 127.357765, 167),
  ('1215038032', '이곡리', 'RI', '12150380', '전남광주통합특별시 순천시 낙안면 이곡리', 34.878955, 127.349787, 168),
  ('1215038033', '용능리', 'RI', '12150380', '전남광주통합특별시 순천시 낙안면 용능리', 34.886532, 127.362521, 169),
  ('1215038034', '내운리', 'RI', '12150380', '전남광주통합특별시 순천시 낙안면 내운리', 34.896278, 127.36031, 170),
  ('1215038035', '창녕리', 'RI', '12150380', '전남광주통합특별시 순천시 낙안면 창녕리', 34.920428, 127.381616, 171),
  ('1215038036', '금산리', 'RI', '12150380', '전남광주통합특별시 순천시 낙안면 금산리', 34.940684, 127.354029, 172),
  ('1215038037', '평사리', 'RI', '12150380', '전남광주통합특별시 순천시 낙안면 평사리', 34.955922, 127.331886, 173),
  ('1215038038', '목촌리', 'RI', '12150380', '전남광주통합특별시 순천시 낙안면 목촌리', 34.940097, 127.322606, 174),
  ('1215038039', '석흥리', 'RI', '12150380', '전남광주통합특별시 순천시 낙안면 석흥리', 34.967068, 127.334108, 175),
  ('12150390', '별량면', 'EMD', '12150', '전남광주통합특별시 순천시 별량면', 34.874363, 127.451941, 176),
  ('1215039021', '봉림리', 'RI', '12150390', '전남광주통합특별시 순천시 별량면 봉림리', 34.874017, 127.444174, 177),
  ('1215039022', '운천리', 'RI', '12150390', '전남광주통합특별시 순천시 별량면 운천리', 34.889731, 127.427722, 178),
  ('1215039023', '송학리', 'RI', '12150390', '전남광주통합특별시 순천시 별량면 송학리', 34.890741, 127.449769, 179),
  ('1215039024', '덕정리', 'RI', '12150390', '전남광주통합특별시 순천시 별량면 덕정리', 34.89516, 127.463547, 180),
  ('1215039025', '우산리', 'RI', '12150390', '전남광주통합특별시 순천시 별량면 우산리', 34.880111, 127.474497, 181),
  ('1215039026', '쌍림리', 'RI', '12150390', '전남광주통합특별시 순천시 별량면 쌍림리', 34.874036, 127.468026, 182),
  ('1215039027', '학산리', 'RI', '12150390', '전남광주통합특별시 순천시 별량면 학산리', 34.858957, 127.487314, 183),
  ('1215039028', '대곡리', 'RI', '12150390', '전남광주통합특별시 순천시 별량면 대곡리', 34.862404, 127.469876, 184),
  ('1215039029', '무풍리', 'RI', '12150390', '전남광주통합특별시 순천시 별량면 무풍리', 34.849947, 127.468034, 185),
  ('1215039030', '마산리', 'RI', '12150390', '전남광주통합특별시 순천시 별량면 마산리', 34.843841, 127.448394, 186),
  ('1215039031', '동송리', 'RI', '12150390', '전남광주통합특별시 순천시 별량면 동송리', 34.858992, 127.452146, 187),
  ('1215039032', '원창리', 'RI', '12150390', '전남광주통합특별시 순천시 별량면 원창리', 34.86787, 127.430059, 188),
  ('1215039033', '두고리', 'RI', '12150390', '전남광주통합특별시 순천시 별량면 두고리', 34.860664, 127.427471, 189),
  ('1215039034', '구룡리', 'RI', '12150390', '전남광주통합특별시 순천시 별량면 구룡리', 34.839166, 127.422624, 190),
  ('1215039035', '송기리', 'RI', '12150390', '전남광주통합특별시 순천시 별량면 송기리', 34.858288, 127.415941, 191),
  ('1215039036', '죽산리', 'RI', '12150390', '전남광주통합특별시 순천시 별량면 죽산리', 34.858285, 127.406165, 192),
  ('1215039037', '금치리', 'RI', '12150390', '전남광주통합특별시 순천시 별량면 금치리', 34.855, 127.389852, 193),
  ('1215039038', '대룡리', 'RI', '12150390', '전남광주통합특별시 순천시 별량면 대룡리', 34.88571, 127.394967, 194),
  ('12150400', '상사면', 'EMD', '12150', '전남광주통합특별시 순천시 상사면', 34.939114, 127.455186, 195),
  ('1215040021', '흘산리', 'RI', '12150400', '전남광주통합특별시 순천시 상사면 흘산리', 34.943952, 127.45453, 196),
  ('1215040022', '응령리', 'RI', '12150400', '전남광주통합특별시 순천시 상사면 응령리', 34.940111, 127.444039, 197),
  ('1215040023', '용계리', 'RI', '12150400', '전남광주통합특별시 순천시 상사면 용계리', 34.953783, 127.423824, 198),
  ('1215040024', '도월리', 'RI', '12150400', '전남광주통합특별시 순천시 상사면 도월리', 34.971844, 127.40114, 199),
  ('1215040025', '봉래리', 'RI', '12150400', '전남광주통합특별시 순천시 상사면 봉래리', 34.950668, 127.381524, 200),
  ('1215040026', '쌍지리', 'RI', '12150400', '전남광주통합특별시 순천시 상사면 쌍지리', 34.932529, 127.41013, 201),
  ('1215040027', '초곡리', 'RI', '12150400', '전남광주통합특별시 순천시 상사면 초곡리', 34.909955, 127.408958, 202),
  ('1215040028', '용암리', 'RI', '12150400', '전남광주통합특별시 순천시 상사면 용암리', 34.929556, 127.437403, 203),
  ('1215040029', '비촌리', 'RI', '12150400', '전남광주통합특별시 순천시 상사면 비촌리', 34.913051, 127.433192, 204),
  ('1215040030', '오곡리', 'RI', '12150400', '전남광주통합특별시 순천시 상사면 오곡리', 34.909656, 127.458306, 205),
  ('1215040031', '마륜리', 'RI', '12150400', '전남광주통합특별시 순천시 상사면 마륜리', 34.923475, 127.458444, 206);

-- 1. Stale 순천시 rows (code not verified, or verified with another name/level) → verified code by
--    name. A 리 must also match its 읍면's name unless the 리 name is unique in the city (같은 이름의
--    리: 신성리 is in 승주읍 and in 해룡면). Rows no verified name matches are kept as they are.
CREATE TEMP TABLE "_region_map" (
  "old_code" VARCHAR(10) PRIMARY KEY,
  "new_code" VARCHAR(10) NOT NULL,
  "old_name" VARCHAR(50) NOT NULL,
  "old_is_active" BOOLEAN NOT NULL
);

INSERT INTO "_region_map" ("old_code", "new_code", "old_name", "old_is_active")
SELECT r."code", t."code", r."name", r."is_active"
FROM "regions" r
LEFT JOIN "regions" rp ON rp."code" = r."parent_code"
CROSS JOIN LATERAL (
  SELECT v."code"
  FROM "_verified_regions" v
  LEFT JOIN "_verified_regions" vp ON vp."code" = v."parent_code"
  WHERE v."level" = r."level" AND v."name" = r."name"
    AND (
      r."level" = 'EMD'
      OR vp."name" = rp."name"
      OR NOT EXISTS (
        SELECT 1 FROM "_verified_regions" v2
        WHERE v2."level" = v."level" AND v2."name" = v."name" AND v2."code" <> v."code"
      )
    )
  ORDER BY (vp."name" IS NOT DISTINCT FROM rp."name") DESC, v."code"
  LIMIT 1
) t
WHERE r."code" ~ '^12150[0-9]{3}([0-9]{2})?$'
  AND NOT EXISTS (
    SELECT 1 FROM "_verified_regions" v
    WHERE v."code" = r."code" AND v."name" = r."name" AND v."level" = r."level"
  );

-- 2. Verified rows: insert the missing ones (parents and children in one statement — the self-FK
--    is checked at the end of the statement), then correct existing rows that disagree. A row
--    that was a stale sample row under a now-verified number also gets the verified position and
--    order; other existing rows keep their admin-maintained lat/lng, order and is_active.
INSERT INTO "regions" (
  "code", "name", "full_name", "level", "parent_code", "lat", "lng", "is_active", "sort_order",
  "created_at", "updated_at"
)
SELECT
  v."code", v."name", v."full_name", v."level", v."parent_code", v."lat", v."lng",
  COALESCE((SELECT bool_or(m."old_is_active") FROM "_region_map" m WHERE m."new_code" = v."code"), true),
  v."sort_order", CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "_verified_regions" v
WHERE EXISTS (SELECT 1 FROM "regions" s WHERE s."code" = '12150')
ON CONFLICT ("code") DO NOTHING;

UPDATE "regions" r
SET
  "name" = v."name",
  "full_name" = v."full_name",
  "level" = v."level",
  "parent_code" = v."parent_code",
  "lat" = CASE WHEN m."old_code" IS NOT NULL OR r."lat" IS NULL OR r."lng" IS NULL THEN v."lat" ELSE r."lat" END,
  "lng" = CASE WHEN m."old_code" IS NOT NULL OR r."lat" IS NULL OR r."lng" IS NULL THEN v."lng" ELSE r."lng" END,
  "sort_order" = CASE WHEN m."old_code" IS NOT NULL THEN v."sort_order" ELSE r."sort_order" END,
  "updated_at" = CURRENT_TIMESTAMP
FROM "_verified_regions" v
LEFT JOIN "_region_map" m ON m."old_code" = v."code"
WHERE r."code" = v."code"
  AND (
    m."old_code" IS NOT NULL
    OR (r."name", r."full_name", r."level", r."parent_code")
      IS DISTINCT FROM (v."name", v."full_name", v."level", v."parent_code")
    OR r."lat" IS NULL OR r."lng" IS NULL
  );

-- 3. Stored codes. house_region_fix(code, address, lat, lng, official_first):
--    - not a stale code → the stored form (10-digit "…00" → 8 digits);
--    - stale code whose number has no other official meaning → the mapped code;
--    - stale code that is also the official number of another 법정동 (sample 조례동 1215011900 =
--      official 장천동): the 법정동 name in the 지번 address decides; else the row's position
--      (the nearer of the two 법정동 points); else official_first.
CREATE FUNCTION pg_temp.house_region_fix(
  p_code TEXT, p_address TEXT, p_lat DOUBLE PRECISION, p_lng DOUBLE PRECISION, p_official_first BOOLEAN
)
RETURNS TEXT LANGUAGE sql STABLE AS $fn$
  SELECT CASE
    WHEN p_code IS NULL THEN NULL
    WHEN m."old_code" IS NULL THEN n.norm
    WHEN v."code" IS NULL OR v."code" = m."new_code" THEN m."new_code"
    WHEN v."name" = ANY (n.tokens) AND NOT m."old_name" = ANY (n.tokens) THEN v."code"
    WHEN m."old_name" = ANY (n.tokens) AND NOT v."name" = ANY (n.tokens) THEN m."new_code"
    WHEN p_lat IS NOT NULL AND p_lng IS NOT NULL THEN
      CASE
        WHEN (v."lat" - p_lat) ^ 2 + ((v."lng" - p_lng) * cos(radians(p_lat))) ^ 2
          <= (mv."lat" - p_lat) ^ 2 + ((mv."lng" - p_lng) * cos(radians(p_lat))) ^ 2
        THEN v."code"
        ELSE m."new_code"
      END
    WHEN p_official_first THEN v."code"
    ELSE m."new_code"
  END
  FROM (
    SELECT
      CASE WHEN p_code ~ '^[0-9]{8}00$' THEN left(p_code, 8) ELSE p_code END AS norm,
      COALESCE(regexp_split_to_array(btrim(p_address), '\s+'), ARRAY[]::TEXT[]) AS tokens
  ) n
  LEFT JOIN LATERAL (
    SELECT x.* FROM "_region_map" x
    WHERE x."old_code" IN (p_code, n.norm)
    ORDER BY (x."old_code" = p_code) DESC
    LIMIT 1
  ) m ON true
  LEFT JOIN "_verified_regions" mv ON mv."code" = m."new_code"
  LEFT JOIN "_verified_regions" v ON v."code" = n.norm
$fn$;

-- Codes from Kakao / the official list (official meaning unless the address or position says
-- the row was placed with a sample code).
UPDATE "properties"
SET "emd_code" = pg_temp.house_region_fix("emd_code", "jibun_address", "lat", "lng", true)
WHERE "emd_code" IS NOT NULL
  AND "emd_code" IS DISTINCT FROM pg_temp.house_region_fix("emd_code", "jibun_address", "lat", "lng", true);

-- A listing copies its property's code; same inputs, so both end up equal.
UPDATE "listings" l
SET "emd_code" = pg_temp.house_region_fix(l."emd_code", p."jibun_address", p."lat", p."lng", true)
FROM "properties" p
WHERE p."id" = l."property_id" AND l."emd_code" IS NOT NULL
  AND l."emd_code" IS DISTINCT FROM pg_temp.house_region_fix(l."emd_code", p."jibun_address", p."lat", p."lng", true);

UPDATE "complexes"
SET "emd_code" = pg_temp.house_region_fix("emd_code", "jibun_address", "lat", "lng", true)
WHERE "emd_code" IS NOT NULL
  AND "emd_code" IS DISTINCT FROM pg_temp.house_region_fix("emd_code", "jibun_address", "lat", "lng", true);

UPDATE "agencies"
SET "emd_code" = pg_temp.house_region_fix("emd_code", "jibun_address", "lat", "lng", true)
WHERE "emd_code" IS NOT NULL
  AND "emd_code" IS DISTINCT FROM pg_temp.house_region_fix("emd_code", "jibun_address", "lat", "lng", true);

UPDATE "deal_requests"
SET "emd_code" = pg_temp.house_region_fix("emd_code", "road_address", "lat", "lng", true)
WHERE "emd_code" IS NOT NULL
  AND "emd_code" IS DISTINCT FROM pg_temp.house_region_fix("emd_code", "road_address", "lat", "lng", true);

-- Codes picked from the region list (the sample rows): the mapped code.
UPDATE "local_videos"
SET "region_code" = pg_temp.house_region_fix("region_code", NULL, NULL, NULL, false)
WHERE "region_code" IS NOT NULL
  AND "region_code" IS DISTINCT FROM pg_temp.house_region_fix("region_code", NULL, NULL, NULL, false);

-- banner_target_regions is keyed (banner_id, region_code): add the mapped row, drop the old one.
INSERT INTO "banner_target_regions" ("banner_id", "region_code")
SELECT b."banner_id", pg_temp.house_region_fix(b."region_code", NULL, NULL, NULL, false)
FROM "banner_target_regions" b
WHERE b."region_code" IS DISTINCT FROM pg_temp.house_region_fix(b."region_code", NULL, NULL, NULL, false)
ON CONFLICT DO NOTHING;
DELETE FROM "banner_target_regions" b
WHERE b."region_code" IS DISTINCT FROM pg_temp.house_region_fix(b."region_code", NULL, NULL, NULL, false);

-- TEXT[] columns: map every element, drop duplicates, keep the first occurrence's order.
UPDATE "deal_requests" d
SET "region_codes" = f."codes"
FROM (
  SELECT d2."id", ARRAY(
    SELECT u."code" FROM (
      SELECT pg_temp.house_region_fix(e."code", NULL, NULL, NULL, false) AS "code", min(e."ord") AS "ord"
      FROM unnest(d2."region_codes") WITH ORDINALITY AS e("code", "ord")
      GROUP BY 1
    ) u ORDER BY u."ord"
  ) AS "codes"
  FROM "deal_requests" d2
  WHERE cardinality(d2."region_codes") > 0
) f
WHERE f."id" = d."id" AND d."region_codes" IS DISTINCT FROM f."codes";

-- 관심 지역: only the numeric 법정동 keys (stable site keys such as "sindae" stay).
UPDATE "user_interest_regions" ui
SET "region_keys" = f."keys"
FROM (
  SELECT u2."user_id", ARRAY(
    SELECT u."key" FROM (
      SELECT
        CASE WHEN e."key" ~ '^[0-9]+$' THEN pg_temp.house_region_fix(e."key", NULL, NULL, NULL, false) ELSE e."key" END AS "key",
        min(e."ord") AS "ord"
      FROM unnest(u2."region_keys") WITH ORDINALITY AS e("key", "ord")
      GROUP BY 1
    ) u ORDER BY u."ord"
  ) AS "keys"
  FROM "user_interest_regions" u2
  WHERE cardinality(u2."region_keys") > 0
) f
WHERE f."user_id" = ui."user_id" AND ui."region_keys" IS DISTINCT FROM f."keys";

-- 4. Stale rows: repoint surviving children, then delete (리 before their 읍면; RESTRICT FK).
UPDATE "regions" r
SET "parent_code" = m."new_code", "updated_at" = CURRENT_TIMESTAMP
FROM "_region_map" m
WHERE r."parent_code" = m."old_code"
  AND NOT EXISTS (SELECT 1 FROM "_verified_regions" v WHERE v."code" = m."old_code")
  AND NOT EXISTS (
    SELECT 1 FROM "_region_map" c
    WHERE c."old_code" = r."code"
      AND NOT EXISTS (SELECT 1 FROM "_verified_regions" v WHERE v."code" = c."old_code")
  );

DELETE FROM "regions" r
USING "_region_map" m
WHERE r."code" = m."old_code" AND r."level" = 'RI'
  AND NOT EXISTS (SELECT 1 FROM "_verified_regions" v WHERE v."code" = m."old_code");

DELETE FROM "regions" r
USING "_region_map" m
WHERE r."code" = m."old_code"
  AND NOT EXISTS (SELECT 1 FROM "_verified_regions" v WHERE v."code" = m."old_code");

DROP FUNCTION pg_temp.house_region_fix(TEXT, TEXT, DOUBLE PRECISION, DOUBLE PRECISION, BOOLEAN);
DROP TABLE "_region_map";
DROP TABLE "_verified_regions";
