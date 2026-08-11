-- 数据库：article
-- 先创建数据库（如果尚未创建，请手动执行：CREATE DATABASE article CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;）
USE article;

-- 1. 客户信息表（预约登记）
DROP TABLE IF EXISTS customers;
CREATE TABLE customers (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(50) NOT NULL COMMENT '姓名',
  gender ENUM('男','女') NOT NULL COMMENT '性别',
  phone VARCHAR(20) NOT NULL COMMENT '电话',
  create_time DATETIME NOT NULL COMMENT '填表时间',
  INDEX idx_create_time (create_time)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='客户预约登记表';

-- 2. 文章/内容主表（三个版块共用）
DROP TABLE IF EXISTS articles;
CREATE TABLE articles (
  id INT AUTO_INCREMENT PRIMARY KEY,
  section ENUM('hot','department','hospital') NOT NULL COMMENT '版块类型：hot=精彩内容, department=热门推荐(科室), hospital=医院推荐',
  sub_type VARCHAR(30) DEFAULT NULL COMMENT '子类型：hot下 hot_topic热点卡片/article文章; department下科室; hospital下医院',
  title VARCHAR(200) NOT NULL COMMENT '标题/名称',
  summary VARCHAR(500) DEFAULT NULL COMMENT '简介/描述',
  content TEXT DEFAULT NULL COMMENT '详细内容',
  image_url VARCHAR(500) DEFAULT NULL COMMENT '图片URL',
  tag_label VARCHAR(50) DEFAULT NULL COMMENT '标签文字',
  tag_color VARCHAR(20) DEFAULT NULL COMMENT '标签颜色：pink/blue/green/orange/purple/red/cyan/yellow',
  location VARCHAR(100) DEFAULT NULL COMMENT '地址（医院版块用）',
  level VARCHAR(50) DEFAULT NULL COMMENT '医院等级（医院版块用）',
  sort_order INT DEFAULT 0 COMMENT '排序（越小越靠前）',
  is_hot TINYINT DEFAULT 0 COMMENT '是否热点/推荐 1=是',
  extra_tags VARCHAR(500) DEFAULT NULL COMMENT '额外标签，逗号分隔',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_section (section),
  INDEX idx_sort (section, sort_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='文章内容表（三个版块）';

-- ==================== 初始化数据 ====================

-- ===== 精彩内容版块(hot) =====
-- 热点知识卡片(sub_type=hot_topic)
INSERT INTO articles (section, sub_type, title, summary, image_url, tag_label, tag_color, sort_order, is_hot) VALUES
('hot', 'hot_topic', '试管婴儿技术全解析：从检查到成功怀孕的完整流程', '全面了解试管婴儿的适应症、治疗流程、费用及成功率，帮助您做出明智的选择。', 'https://coresg-normal.trae.ai/api/ide/v1/text_to_image?prompt=ivf%20laboratory%20medical%20embryologist%20professional%20clinic%20hospital&image_size=landscape_16_9', 'HOT 热点', 'red', 1, 1),
('hot', 'hot_topic', '科学备孕指南：孕前准备、饮食调理、生活习惯全攻略', '孕前3-6个月开始调理，夫妻双方共同准备，提高受孕几率。', 'https://coresg-normal.trae.ai/api/ide/v1/text_to_image?prompt=pregnancy%20planning%20medical%20consultation%20couple%20hospital%20professional&image_size=square_hd', '备孕', 'pink', 2, 1),
('hot', 'hot_topic', '不孕不育的常见原因与科学治疗方案解读', '男女双方因素各占约40%，不明原因约20%，建议夫妻同诊同治。', 'https://coresg-normal.trae.ai/api/ide/v1/text_to_image?prompt=infertility%20medical%20clinic%20doctor%20consultation%20professional%20hospital&image_size=square_hd', '不孕不育', 'blue', 3, 1);

-- 文章链接(sub_type=article)
INSERT INTO articles (section, sub_type, title, summary, tag_label, tag_color, sort_order, created_at) VALUES
('hot', 'article', '女性最佳生育年龄是多少？高龄备孕注意事项', '25-29岁为最佳生育年龄，35岁后卵巢功能逐渐下降。', '备孕', 'pink', 1, '2026-08-08 00:00:00'),
('hot', 'article', '精子质量差怎么办？提高精子活力的方法', '戒烟戒酒、避免久坐、适度运动、补充锌硒。', '男性健康', 'blue', 2, '2026-08-07 00:00:00'),
('hot', 'article', '多囊卵巢综合征能自然怀孕吗？治疗方法介绍', '通过生活方式调整+促排卵治疗，约70%患者可成功受孕。', '妇科', 'green', 3, '2026-08-06 00:00:00'),
('hot', 'article', '输卵管堵塞的症状有哪些？检查方法详解', '输卵管造影是目前最常用的检查方法，准确率高。', '输卵管', 'orange', 4, '2026-08-05 00:00:00'),
('hot', 'article', '人工授精和试管婴儿的区别 适应症对比', '人工授精主要解决男性因素，试管针对更复杂不孕情况。', '人工授精', 'purple', 5, '2026-08-04 00:00:00'),
('hot', 'article', '孕期产检时间表 各个阶段检查项目汇总', '12周建档、16周唐筛、24周四维、32周胎心监护。', '孕期', 'pink', 6, '2026-08-03 00:00:00'),
('hot', 'article', '月经不调影响怀孕吗？调经助孕的方法', '月经不调常伴随排卵异常，需先明确病因再调经。', '内分泌', 'blue', 7, '2026-08-02 00:00:00'),
('hot', 'article', '孕前检查项目清单 男女双方检查大全', '建议孕前3-6个月完成全部检查项目。', '优生优育', 'green', 8, '2026-08-01 00:00:00');

-- ===== 热门推荐-科室版块(department) =====
INSERT INTO articles (section, sub_type, title, summary, tag_label, tag_color, sort_order) VALUES
('department', '生殖医学中心', '生殖医学中心', '试管婴儿、人工授精、不孕不育诊疗、胚胎培养技术', '👩‍⚕️', 'pink', 1),
('department', '男科', '男科', '男性不育症、少弱精症、精索静脉曲张、性功能障碍', '👨‍⚕️', 'blue', 2),
('department', '妇科', '妇科', '子宫肌瘤、卵巢囊肿、子宫内膜异位症、妇科炎症', '🏥', 'green', 3),
('department', '内分泌科', '内分泌科', '多囊卵巢、月经不调、排卵障碍、甲状腺疾病', '🔬', 'orange', 4),
('department', '中医科', '中医科', '中医调理备孕、调经助孕、胎停育调理、体质调养', '💊', 'purple', 5),
('department', '遗传咨询科', '遗传咨询科', '染色体检查、遗传病筛查、产前诊断、优生咨询', '🧬', 'red', 6),
('department', '检验科', '检验科', '精液分析、激素六项、染色体检测、免疫抗体检查', '🧪', 'cyan', 7),
('department', '产前诊断中心', '产前诊断中心', '唐氏筛查、无创DNA、羊水穿刺、超声排畸检查', '❤️', 'yellow', 8);

-- ===== 医院推荐版块(hospital) =====
INSERT INTO articles (section, sub_type, title, summary, image_url, location, level, extra_tags, sort_order) VALUES
('hospital', '综合三甲', '北京协和医院生殖医学中心', '国家重点学科，国内生殖医学领域权威机构', 'https://coresg-normal.trae.ai/api/ide/v1/text_to_image?prompt=beijing%20union%20medical%20college%20hospital%20exterior%20modern&image_size=landscape_4_3', '北京市东城区', '三级甲等', '国家重点学科,试管成功率高', 1),
('hospital', '综合三甲', '北京大学第三医院生殖医学中心', '中国大陆首例试管婴儿诞生地，国际先进水平', 'https://coresg-normal.trae.ai/api/ide/v1/text_to_image?prompt=peking%20university%20third%20hospital%20modern%20medical%20center&image_size=landscape_4_3', '北京市海淀区', '三级甲等', '中国大陆首例试管,国际先进水平', 2),
('hospital', '综合三甲', '上海瑞金医院生殖医学中心', '上海交通大学医学院附属，综合实力雄厚', 'https://coresg-normal.trae.ai/api/ide/v1/text_to_image?prompt=shanghai%20ruijin%20hospital%20modern%20building%20medical&image_size=landscape_4_3', '上海市黄浦区', '三级甲等', '综合实力强,专家团队', 3),
('hospital', '综合三甲', '广州中山一院生殖医学中心', '华南地区生殖医学龙头，技术精湛', 'https://coresg-normal.trae.ai/api/ide/v1/text_to_image?prompt=guangzhou%20sun%20yat-sen%20university%20hospital%20medical&image_size=landscape_4_3', '广州市越秀区', '三级甲等', '华南地区领先,技术精湛', 4),
('hospital', '专科三甲', '华西第二医院生殖医学中心', '四川大学华西附属，西南地区首选', 'https://coresg-normal.trae.ai/api/ide/v1/text_to_image?prompt=chengdu%20huaxi%20second%20hospital%20modern%20womens%20hospital&image_size=landscape_4_3', '成都市锦江区', '三级甲等', '西南地区首选,学科齐全', 5),
('hospital', '专科三甲', '浙江大学医学院附属妇产科医院', '华东地区知名妇产专科医院，服务优质', 'https://coresg-normal.trae.ai/api/ide/v1/text_to_image?prompt=zhejiang%20university%20womens%20hospital%20modern%20medical&image_size=landscape_4_3', '杭州市上城区', '三级甲等', '华东地区知名,服务优质', 6);
