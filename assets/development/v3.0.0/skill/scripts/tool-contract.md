# 完整工具脚本合同（实现待交付）
本发布资源仅含接口设计，没有可运行的生产工具代码。后续真实工具脚本必须进入同一锁定清单、完整预加载其受信任代码/说明并验证依赖，才能开放会话。
允许inspect/read/unitize/OCR/run_generated_script/write_analysis_preview/validate_candidates/request_checkpoint。BATCH阶段才允许build_full_artifacts；ANALYZE仅输出分析/规范/计划/至多5条小样。脚本与Agent使用授权工作区，不读全局密钥/他人任务、不联网装依赖。价格/付款/采用/持久发布/环境销毁由Host掌握。清理器是可信应用程序，不由Agent自己写或自证成功。
