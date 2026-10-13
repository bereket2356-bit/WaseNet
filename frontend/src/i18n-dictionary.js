/**
 * WaseNet Internationalization Module
 * Supports English (en) and Amharic (am).
 * Note: Amharic strings are marked for native-speaker review (የቋንቋ ባለሙያ ግምገማ).
 */

const STORAGE_KEY = 'wasenet_lang';

export const dictionaries = {
  en: {
    // Brand & Global
    'brand.name': 'WaseNet',
    'brand.tagline': 'Document authentication for public offices in Ethiopia',
    'lang.toggle': 'አማርኛ',
    'nav.verify': 'Verify',
    'nav.who': "Who it's for",
    'nav.how': 'How it works',
    'nav.contact': 'Contact',
    'nav.check_doc': 'Check a document',
    'nav.issue': 'Issue',
    'nav.queue': 'Queue',
    'nav.audit': 'Audit',
    'nav.admin_keys': 'Keys',
    'nav.admin_revoke': 'Revoke',
    'nav.admin_issuers': 'Issuers',
    'nav.sync': 'Sync',
    'nav.sign_in': 'Sign in',
    'nav.sign_out': 'Sign out',

    // Sync bar
    'sync.online': 'Online',
    'sync.offline': 'Offline (using cached registry)',
    'sync.last_sync': 'Last sync:',
    'sync.never': 'Never',
    'sync.drl_version': 'Revocation list v{v}',
    'sync.key_version': 'Key bundle v{v}',
    'sync.action': 'Sync now',
    'sync.offline_banner': "You're offline. Core verification continues using local cached keys.",

    // Landing Page
    'landing.hero.pill_tag': 'New',
    'landing.hero.pill_text': 'Works fully offline for up to 30 days',
    'landing.hero.headline': 'Check a document in one scan.',
    'landing.hero.supporting': 'WaseNet confirms that land certificates, cooperative credentials, and local permits are genuine, even without a signal.',
    'landing.hero.scan_btn': 'Scan a document',
    'landing.hero.offices_btn': 'For issuing offices',

    'landing.preview.doc_title': 'Land certificate',
    'landing.preview.holder_label': 'Holder',
    'landing.preview.holder_name': 'Abebe Bikila',
    'landing.preview.issuer_label': 'Issuer',
    'landing.preview.issuer_code': 'KEBELE-04-AA',
    'landing.preview.issued_label': 'Issued',
    'landing.preview.issued_val': '1 Oct 2026',
    'landing.preview.expires_label': 'Expires',
    'landing.preview.expires_val': '1 Oct 2028',
    'landing.preview.qr_code': 'QR code',
    'landing.preview.valid_title': 'Valid',
    'landing.preview.valid_sub': 'Signature checked on this device',
    'landing.preview.caption_doc': 'Document f81d4fae-…6bf6',
    'landing.preview.caption_time': 'Checked in 1.8 seconds',

    'landing.figures.f1_num': '30 days',
    'landing.figures.f1_label': 'Works without a signal',
    'landing.figures.f2_num': 'Under 2 s',
    'landing.figures.f2_label': 'From scan to result',
    'landing.figures.f3_num': '4 results',
    'landing.figures.f3_label': 'Valid, tampered, revoked, or expired',

    'landing.features.heading': 'Built for the counter and the field',
    'landing.features.intro': 'One app for the people who check documents and the offices that issue them.',
    'landing.features.c1_title': 'For verifiers',
    'landing.features.c1_body': 'Bank tellers, border staff, and anyone holding a document. Scan the code, read the result, and act on it. No account needed.',
    'landing.features.c2_title': 'For issuing offices',
    'landing.features.c2_body': 'Kebele officers and health post managers fill in one form, sign the credential, and print the QR code. Offline work waits in a queue and syncs later.',
    'landing.features.c3_title': 'For administrators',
    'landing.features.c3_body': 'Manage signing keys, cancel documents that were issued in error or reported lost, and keep an audit trail of every check.',

    'landing.closing.heading': 'Make a document checkable in seconds.',
    'landing.closing.supporting': "Start with one office or one scanner. Expand when you're ready.",
    'landing.closing.btn': 'Get started',

    'footer.description': "Document authentication for public offices, built to work when the network doesn't.",
    'footer.link_verify': 'Verify',
    'footer.link_offices': 'Offices',
    'footer.link_privacy': 'Privacy',
    'footer.link_contact': 'Contact',
    'footer.copyright': '© 2026 WaseNet. Prototype for INSA capstone evaluation.',

    // Page 2: Verify
    'verify.heading': 'Scan a document',
    'verify.subheading': 'Hold the QR code inside the frame.',
    'verify.btn_scan': 'Scan a document',
    'verify.or_title': 'Or enter a document ID',
    'verify.id_label': 'Document ID',
    'verify.id_placeholder': 'e.g. 550e8400-e29b-41d4-a716-446655440000',
    'verify.id_hint': 'Needs a connection to check revocation status',
    'verify.btn_check_id': 'Check this ID',
    'verify.camera_instruction': 'Hold the QR code inside the frame.',
    'verify.btn_cancel': 'Cancel',
    'verify.or_samples': 'Or test with a sample document',
    'verify.sample_valid': 'Test valid certificate',
    'verify.sample_tampered': 'Test tampered certificate',
    'verify.sample_revoked': 'Test revoked certificate',
    'verify.sample_expired': 'Test expired certificate',
    'verify.upload_qr': 'Upload QR image file',

    // Page 3: Result
    'result.heading': 'Verification result',
    'result.status.valid.title': 'Authentic and current.',
    'result.status.valid.desc': 'This document has a valid digital signature from an accredited public office.',
    'result.status.tampered.title': 'This document failed the signature check. Do not accept it.',
    'result.status.tampered.desc': 'The cryptographic signature does not match the content. The document has been modified.',
    'result.status.revoked.title': 'This document has been cancelled by the issuing office.',
    'result.status.revoked.desc': 'The document has been officially placed on the national revocation list.',
    'result.status.expired.title': 'The signature is genuine, but this document is past its expiry date.',
    'result.status.expired.desc': 'This document reached its validity date and is no longer current.',
    'result.status.unreadable.title': 'This QR code could not be read. Try again with better lighting.',
    'result.status.unreadable.desc': 'The scanned code is damaged or does not contain a recognized WaseNet credential.',

    'result.details_title': 'Document details',
    'result.detail.doc_type': 'Document type',
    'result.detail.holder_name': 'Holder name',
    'result.detail.holder_id': 'Holder ID',
    'result.detail.issuer_code': 'Issuer code',
    'result.detail.doc_id': 'Document ID',
    'result.detail.issued': 'Issued',
    'result.detail.expires': 'Expires',
    'result.details_hidden': 'Details are hidden because the signature did not match.',
    'result.btn_scan_another': 'Scan another document',
    'result.online_check_status': 'Live registry check completed.',
    'result.online_check_pending': 'Background verification check in progress…',

    // Page 4: Login
    'login.heading': 'Sign in',
    'login.subheading': 'Sign in to access document issuance and registry administration.',
    'login.username_label': 'Username',
    'login.password_label': 'Password',
    'login.btn_sign_in': 'Sign in',
    'login.error_failed': 'Sign-in failed. Check your username and password.',
    'login.session_ended': 'Your session ended. Sign in again. Your unsaved form data is kept.',
    'login.hint_roles': 'Demo accounts: issuer / issuer123 (Issuing office) or admin / admin123 (Administrator)',

    // Page 5: Issue
    'issue.heading': 'Issue a document',
    'issue.subheading': 'Create and sign a tamper-evident digital credential for a citizen.',
    'issue.doc_id_label': 'Document ID',
    'issue.btn_regenerate': 'Regenerate',
    'issue.type_label': 'Document type',
    'issue.type_land': 'Land certificate',
    'issue.type_coop': 'Cooperative credential',
    'issue.type_birth': 'Birth record',
    'issue.type_permit': 'Local permit',
    'issue.holder_name_label': 'Holder full name',
    'issue.holder_id_label': 'Holder national or Kebele ID',
    'issue.issue_date_label': 'Issue date',
    'issue.expiry_date_label': 'Expiry date',
    'issue.issuer_code_label': 'Issuer code',
    'issue.val_expiry': 'Expiry date must be after the issue date.',
    'issue.val_name': 'Enter the holder full name as shown on legal identity documents.',
    'issue.val_id': 'Enter a valid national ID or Kebele identification number.',
    'issue.val_issuer': 'Enter the authorized issuer code for your office.',
    'issue.btn_sign': 'Sign and create document',
    'issue.offline_notice': "You're offline. This document will be saved and sent when you're back online.",

    // Page 6: Issue Done
    'done.heading': 'Document created',
    'done.subheading': 'The digital credential has been signed and the verification code is ready.',
    'done.qr_caption': 'Level M error correction QR code',
    'done.btn_print': 'Print',
    'done.btn_save_img': 'Save as image',
    'done.status_online': 'Created and synced',
    'done.status_offline': 'Waiting to sync',
    'done.link_issue_another': 'Issue another document',

    // Page 7: Queue
    'queue.heading': 'Issuance queue',
    'queue.subheading': 'Documents created offline waiting to sync with the central registry.',
    'queue.col_type': 'Document type',
    'queue.col_holder': 'Holder name',
    'queue.col_time': 'Time created',
    'queue.col_status': 'Status',
    'queue.status_waiting': 'Waiting to sync',
    'queue.btn_sync_now': 'Sync now',
    'queue.empty': 'No documents are waiting to sync.',
    'queue.offline_reason': 'Connect to the internet to sync.',

    // Page 8: Audit
    'audit.heading': 'Verification audit log',
    'audit.subheading': 'Historical record of documents verified on this device.',
    'audit.filter_all': 'All',
    'audit.filter_valid': 'Valid',
    'audit.filter_tampered': 'Tampered',
    'audit.filter_revoked': 'Revoked',
    'audit.filter_expired': 'Expired',
    'audit.col_doc_id': 'Document ID',
    'audit.col_timestamp': 'Timestamp',
    'audit.col_result': 'Result',
    'audit.col_device_id': 'Device ID',
    'audit.empty': 'No verifications recorded on this device yet.',

    // Page 9: Keys
    'keys.heading': 'Public keys',
    'keys.subheading': 'Active and historical cryptographic public keys used for signature verification.',
    'keys.col_kid': 'Key ID',
    'keys.col_created': 'Created date',
    'keys.col_status': 'Status',
    'keys.col_actions': 'Actions',
    'keys.status_active': 'Active',
    'keys.status_expired': 'Expired',
    'keys.status_revoked': 'Revoked',
    'keys.btn_change_status': 'Change status',
    'keys.btn_add_key': 'Add public key',

    // Page 10: Revoke
    'revoke.heading': 'Revoke a document',
    'revoke.subheading': 'Cancel an issued credential to prevent further acceptance.',
    'revoke.doc_id_label': 'Document ID',
    'revoke.reason_label': 'Reason',
    'revoke.reason_error': 'Issued in error',
    'revoke.reason_lost': 'Reported lost',
    'revoke.reason_forged': 'Reported forged',
    'revoke.reason_holder': 'Holder request',
    'revoke.version_notice': 'Revocation list version {v}, updated today',
    'revoke.confirm_title': 'Revoke this document?',
    'revoke.confirm_desc': 'Verifiers will see it as revoked after the next sync.',
    'revoke.btn_confirm': 'Revoke document',
    'revoke.btn_cancel': 'Cancel',
    'revoke.success': 'Document successfully revoked.',

    // Page 11: Issuers
    'issuers.heading': 'Issuing offices',
    'issuers.subheading': 'Accredited public offices authorized to issue WaseNet credentials.',
    'issuers.col_name': 'Name',
    'issuers.col_code': 'Issuer code',
    'issuers.col_status': 'Status',
    'issuers.col_actions': 'Actions',
    'issuers.status_active': 'Active',
    'issuers.status_disabled': 'Disabled',
    'issuers.btn_disable': 'Disable',
    'issuers.btn_enable': 'Enable',
    'issuers.btn_add_issuer': 'Add issuer',

    // Page 12: Sync
    'sync_page.heading': 'Sync status',
    'sync_page.subheading': 'Registry synchronization and cryptographic bundle freshness.',
    'sync_page.last_sync_label': 'Last successful sync',
    'sync_page.drl_label': 'Revocation list version',
    'sync_page.keys_label': 'Key bundle version',
    'sync_page.btn_sync': 'Sync now',
    'sync_page.offline_reason': 'Connect to the internet to sync.',
    'sync_page.synced_just_now': 'Synced just now',
    'sync_page.sync_success': 'Synchronization completed successfully.'
  },

  am: {
    // Brand & Global (marked for native-speaker review)
    'brand.name': 'ዋሴኔት',
    'brand.tagline': 'በኢትዮጵያ ውስጥ ለመንግሥት መሥሪያ ቤቶች የሰነድ ማረጋገጫ ሥርዓት',
    'lang.toggle': 'English',
    'nav.verify': 'አረጋግጥ',
    'nav.who': 'ለማን የተዘጋጀ',
    'nav.how': 'እንዴት እንደሚሠራ',
    'nav.contact': 'አግኙን',
    'nav.check_doc': 'ሰነድ ፈትሽ',
    'nav.issue': 'ሰነድ አውጣ',
    'nav.queue': 'የጥበቃ ዝርዝር',
    'nav.audit': 'የምርመራ መዝገብ',
    'nav.admin_keys': 'የቁልፍ አስተዳደር',
    'nav.admin_revoke': 'ሰነድ ሰርዝ',
    'nav.admin_issuers': 'ሰነድ ሰጪዎች',
    'nav.sync': 'አመሳስል',
    'nav.sign_in': 'ግባ',
    'nav.sign_out': 'ውጣ',

    // Sync bar
    'sync.online': 'መስመር ላይ',
    'sync.offline': 'ከመስመር ውጭ (የተቀመጠውን መረጃ በመጠቀም ላይ)',
    'sync.last_sync': 'የመጨረሻው ማመሳሰል:',
    'sync.never': 'አልተደረገም',
    'sync.drl_version': 'የስረዛ ዝርዝር ስሪት {v}',
    'sync.key_version': 'የቁልፍ ጥቅል ስሪት {v}',
    'sync.action': 'አሁን አመሳስል',
    'sync.offline_banner': 'ከመስመር ውጭ ነዎት። የመሠረታዊ ሰነድ ማረጋገጫ በተቀመጡት ቁልፎች ይቀጥላል።',

    // Landing Page
    'landing.hero.pill_tag': 'አዲስ',
    'landing.hero.pill_text': 'ያለ ኔትወርክ እስከ 30 ቀናት ሙሉ በሙሉ ይሠራል',
    'landing.hero.headline': 'ሰነድን በአንድ ቅኝት ያረጋግጡ።',
    'landing.hero.supporting': 'ዋሴኔት የመሬት ይዞታ ማረጋገጫዎችን፣ የሕብረት ሥራ ማስረጃዎችንና የአካባቢ ፈቃዶችን ያለ ኔትወርክ ትክክለኛነት ያረጋግጣል።',
    'landing.hero.scan_btn': 'ሰነድ ቃኝ',
    'landing.hero.offices_btn': 'ለሰነድ ሰጪ መሥሪያ ቤቶች',

    'landing.preview.doc_title': 'የመሬት ይዞታ ምስክር ወረቀት',
    'landing.preview.holder_label': 'ባለቤት',
    'landing.preview.holder_name': 'አበበ ቢቂላ',
    'landing.preview.issuer_label': 'ሰጪ',
    'landing.preview.issuer_code': 'KEBELE-04-AA',
    'landing.preview.issued_label': 'የተሰጠበት',
    'landing.preview.issued_val': '1 ጥቅምት 2026',
    'landing.preview.expires_label': 'የሚያበቃበት',
    'landing.preview.expires_val': '1 ጥቅምት 2028',
    'landing.preview.qr_code': 'QR ኮድ',
    'landing.preview.valid_title': 'ትክክለኛ',
    'landing.preview.valid_sub': 'ፊርማው በዚህ መሣሪያ ላይ ተረጋግጧል',
    'landing.preview.caption_doc': 'የሰነድ መለያ f81d4fae-…6bf6',
    'landing.preview.caption_time': 'በ1.8 ሰከንዶች ውስጥ ተረጋግጧል',

    'landing.figures.f1_num': '30 ቀናት',
    'landing.figures.f1_label': 'ያለ ምንም ኔትወርክ ይሠራል',
    'landing.figures.f2_num': 'ከ2 ሰከንድ በታች',
    'landing.figures.f2_label': 'ከቅኝት እስከ ውጤት',
    'landing.figures.f3_num': '4 ውጤቶች',
    'landing.figures.f3_label': 'ትክክለኛ፣ የተበረዘ፣ የተሰረዘ ወይም ጊዜው ያለፈበት',

    'landing.features.heading': 'ለቢሮ ቆጣሪና ለመስክ ሥራ የተገነባ',
    'landing.features.intro': 'ሰነዶችን ለሚያረጋግጡ ሰዎች እና ለሚሰጡ መሥሪያ ቤቶች አንድ መተግበሪያ።',
    'landing.features.c1_title': 'ለአረጋጋጮች',
    'landing.features.c1_body': 'የባንክ ሠራተኞች፣ የድንበር ጠባቂዎች እና ሰነድ የያዘ ማንኛውም ሰው። ኮዱን ይቃኙ፣ ውጤቱን ይመልከቱ፣ እርምጃ ይውሰዱ። የተጠቃሚ መለያ አያስፈልግም።',
    'landing.features.c2_title': 'ለሰነድ ሰጪ መሥሪያ ቤቶች',
    'landing.features.c2_body': 'የቀበሌ ኃላፊዎችና የጤና ኬላ አስተዳዳሪዎች አንዱን ቅጽ ይሞላሉ፣ ምስክርነቱን በዲጂታል ይፈርማሉ፣ የQR ኮዱን ያትማሉ። ከመስመር ውጭ የሚሠራ ሥራ በጥበቃ ዝርዝር ቆይቶ በኋላ ይመሳሰላል።',
    'landing.features.c3_title': 'ለአስተዳዳሪዎች',
    'landing.features.c3_body': 'የፊርማ ቁልፎችን ያስተዳድሩ፣ በስህተት የተሰጡ ወይም የጠፉ የተባሉ ሰነዶችን ይሰርዙ፣ እና የእያንዳንዱን ቅኝት ኦዲት መዝገብ ይያዙ።',

    'landing.closing.heading': 'ሰነድን በሰከንዶች ውስጥ የሚረጋገጥ ያድርጉ።',
    'landing.closing.supporting': 'በአንድ ቢሮ ወይም በአንድ ስካነር ይጀምሩ። ዝግጁ ሲሆኑ ያስፋፉ።',
    'landing.closing.btn': 'አሁን ጀምር',

    'footer.description': 'የሕዝብ መሥሪያ ቤቶች የሰነድ ማረጋገጫ፣ ኔትወርክ ባይኖርም እንዲሠራ የተገነባ።',
    'footer.link_verify': 'አረጋግጥ',
    'footer.link_offices': 'መሥሪያ ቤቶች',
    'footer.link_privacy': 'ግላዊነት',
    'footer.link_contact': 'አግኙን',
    'footer.copyright': '© 2026 ዋሴኔት። የኢንሳ የካፕስቶን ግምገማ ምሳሌ።',

    // Page 2: Verify
    'verify.heading': 'ሰነድ ቃኝ',
    'verify.subheading': 'የQR ኮዱን በማዕቀፉ ውስጥ ያቆዩት።',
    'verify.btn_scan': 'ሰነድ ቃኝ',
    'verify.or_title': 'ወይም የሰነድ መለያ ያስገቡ',
    'verify.id_label': 'የሰነድ መለያ ቁጥር',
    'verify.id_placeholder': 'ለምሳሌ 550e8400-e29b-41d4-a716-446655440000',
    'verify.id_hint': 'የስረዛ ሁኔታን ለመፈተሽ የኢንተርኔት ግንኙነት ያስፈልጋል',
    'verify.btn_check_id': 'ይህን መለያ ፈትሽ',
    'verify.camera_instruction': 'የQR ኮዱን በማዕቀፉ ውስጥ ያቆዩት።',
    'verify.btn_cancel': 'ሰርዝ',
    'verify.or_samples': 'ወይም በናሙና ሰነድ ይሞክሩ',
    'verify.sample_valid': 'ትክክለኛ ምስክር ወረቀት ሞክር',
    'verify.sample_tampered': 'የተበረዘ ምስክር ወረቀት ሞክር',
    'verify.sample_revoked': 'የተሰረዘ ምስክር ወረቀት ሞክር',
    'verify.sample_expired': 'ጊዜው ያለፈበት ምስክር ወረቀት ሞክር',
    'verify.upload_qr': 'የQR ምስል ፋይል ስቀል',

    // Page 3: Result
    'result.heading': 'የማረጋገጫ ውጤት',
    'result.status.valid.title': 'ትክክለኛ እና ሕጋዊ።',
    'result.status.valid.desc': 'ይህ ሰነድ እውቅና ካለው የመንግሥት መሥሪያ ቤት ትክክለኛ የዲጂታል ፊርማ አለው።',
    'result.status.tampered.title': 'ይህ ሰነድ የፊርማ ምርመራውን አላለፈም። እንዳይቀበሉት።',
    'result.status.tampered.desc': 'የዲጂታል ፊርማው ከሰነዱ ይዘት ጋር አይዛመድም። ሰነዱ ተለውጧል ወይም ተበርዟል።',
    'result.status.revoked.title': 'ይህ ሰነድ በሰጪው መሥሪያ ቤት ተሰርዟል።',
    'result.status.revoked.desc': 'ይህ ሰነድ በይፋዊው የብሔራዊ ስረዛ ዝርዝር ውስጥ ተመዝግቧል።',
    'result.status.expired.title': 'ፊርማው ትክክለኛ ነው፣ ነገር ግን የሰነዱ የአገልግሎት ጊዜ አልፏል።',
    'result.status.expired.desc': 'ይህ ሰነድ አገልግሎት የሚሰጥበት ቀን ያለፈ በመሆኑ ተቀባይነት የለውም።',
    'result.status.unreadable.title': 'ይህ የQR ኮድ ሊነበብ አልቻለም። የተሻለ ብርሃን በመጠቀም እንደገና ይሞክሩ።',
    'result.status.unreadable.desc': 'የተቃኘው ኮድ ተጎድቷል ወይም የሚታወቅ የዋሴኔት ሰነድ አልያዘም።',

    'result.details_title': 'የሰነዱ ዝርዝር መረጃ',
    'result.detail.doc_type': 'የሰነዱ ዓይነት',
    'result.detail.holder_name': 'የባለቤቱ ስም',
    'result.detail.holder_id': 'የባለቤቱ መለያ ቁጥር',
    'result.detail.issuer_code': 'የሰጪ መሥሪያ ቤት መለያ',
    'result.detail.doc_id': 'የሰነድ መለያ ቁጥር',
    'result.detail.issued': 'የተሰጠበት ቀን',
    'result.detail.expires': 'የሚያበቃበት ቀን',
    'result.details_hidden': 'ፊርማው ባለመመሳሰሉ ዝርዝር መረጃው ተደብቋል።',
    'result.btn_scan_another': 'ሌላ ሰነድ ቃኝ',
    'result.online_check_status': 'የቀጥታ መዝገብ ፍተሻ ተጠናቋል።',
    'result.online_check_pending': 'የጀርባ ማረጋገጫ ፍተሻ በመካሄድ ላይ ነው…',

    // Page 4: Login
    'login.heading': 'ይግቡ',
    'login.subheading': 'ሰነዶችን ለማውጣትና መዝገብን ለማስተዳደር ይግቡ።',
    'login.username_label': 'የተጠቃሚ ስም',
    'login.password_label': 'የይለፍ ቃል',
    'login.btn_sign_in': 'ግባ',
    'login.error_failed': 'መግባት አልተሳካም። የተጠቃሚ ስምዎን እና የይለፍ ቃልዎን ያረጋግጡ።',
    'login.session_ended': 'የሥራ ቆይታዎ አብቅቷል። እንደገና ይግቡ። ያልተቀመጠው የቅጽ መረጃዎ ተጠብቋል።',
    'login.hint_roles': 'የናሙና መለያዎች: issuer / issuer123 (ለሰነድ ሰጪ) ወይም admin / admin123 (ለአስተዳዳሪ)',

    // Page 5: Issue
    'issue.heading': 'ሰነድ አውጣ',
    'issue.subheading': 'ለዜጋ ብረዛን የሚከላከል የተፈረመ ዲጂታል ማስረጃ ያዘጋጁ።',
    'issue.doc_id_label': 'የሰነድ መለያ ቁጥር',
    'issue.btn_regenerate': 'አዲስ አፍልቅ',
    'issue.type_label': 'የሰነዱ ዓይነት',
    'issue.type_land': 'የመሬት ይዞታ ምስክር ወረቀት',
    'issue.type_coop': 'የሕብረት ሥራ ማስረጃ',
    'issue.type_birth': 'የልደት ምስክር ወረቀት',
    'issue.type_permit': 'የአካባቢ የንግድ ፈቃድ',
    'issue.holder_name_label': 'የባለቤቱ ሙሉ ስም',
    'issue.holder_id_label': 'የብሔራዊ መታወቂያ ወይም የቀበሌ መለያ ቁጥር',
    'issue.issue_date_label': 'የተሰጠበት ቀን',
    'issue.expiry_date_label': 'የሚያበቃበት ቀን',
    'issue.issuer_code_label': 'የሰጪ መሥሪያ ቤት መለያ',
    'issue.val_expiry': 'የሚያበቃበት ቀን ከተሰጠበት ቀን በኋላ መሆን አለበት።',
    'issue.val_name': 'በሕጋዊ መታወቂያ ላይ የሚታየውን ሙሉ ስም ያስገቡ።',
    'issue.val_id': 'ትክክለኛ የብሔራዊ መታወቂያ ወይም የቀበሌ መለያ ያስገቡ።',
    'issue.val_issuer': 'ለመሥሪያ ቤትዎ የተሰጠውን ፈቃድ ያለው መለያ ያስገቡ።',
    'issue.btn_sign': 'ፈረም እና ሰነድ ፍጠር',
    'issue.offline_notice': 'ከመስመር ውጭ ነዎት። ይህ ሰነድ ተቀምጦ መስመር ሲገኝ ይላካል።',

    // Page 6: Issue Done
    'done.heading': 'ሰነድ ተፈጥሯል',
    'done.subheading': 'ዲጂታል ማስረጃው ተፈርሟል እንዲሁም የማረጋገጫ ኮዱ ተዘጋጅቷል።',
    'done.qr_caption': 'ደረጃ M የስህተት እርማት ያለው የQR ኮድ',
    'done.btn_print': 'አትም',
    'done.btn_save_img': 'እንደ ምስል አስቀምጥ',
    'done.status_online': 'ተፈጥሮ ተመሳስሏል',
    'done.status_offline': 'ለማመሳሰል በመጠባበቅ ላይ',
    'done.link_issue_another': 'ሌላ ሰነድ አውጣ',

    // Page 7: Queue
    'queue.heading': 'የጥበቃ ዝርዝር',
    'queue.subheading': 'ከመስመር ውጭ የተፈጠሩና ወደ ማዕከላዊ መዝገብ ለመላክ የሚጠባበቁ ሰነዶች።',
    'queue.col_type': 'የሰነዱ ዓይነት',
    'queue.col_holder': 'የባለቤቱ ስም',
    'queue.col_time': 'የተፈጠረበት ጊዜ',
    'queue.col_status': 'ሁኔታ',
    'queue.status_waiting': 'ለማመሳሰል በመጠባበቅ ላይ',
    'queue.btn_sync_now': 'አሁን አመሳስል',
    'queue.empty': 'ለማመሳሰል የሚጠባበቅ ምንም ሰነድ የለም።',
    'queue.offline_reason': 'ለማመሳሰል ከኢንተርኔት ጋር ይገናኙ።',

    // Page 8: Audit
    'audit.heading': 'የምርመራ መዝገብ',
    'audit.subheading': 'በዚህ መሣሪያ ላይ የተረጋገጡ ሰነዶች ታሪክ።',
    'audit.filter_all': 'ሁሉም',
    'audit.filter_valid': 'ትክክለኛ',
    'audit.filter_tampered': 'የተበረዘ',
    'audit.filter_revoked': 'የተሰረዘ',
    'audit.filter_expired': 'ጊዜው ያለፈበት',
    'audit.col_doc_id': 'የሰነድ መለያ ቁጥር',
    'audit.col_timestamp': 'የተፈተሸበት ጊዜ',
    'audit.col_result': 'ውጤት',
    'audit.col_device_id': 'የመሣሪያ መለያ',
    'audit.empty': 'በዚህ መሣሪያ ላይ የተመዘገበ ምንም ማረጋገጫ እስካሁን የለም።',

    // Page 9: Keys
    'keys.heading': 'የሕዝብ ቁልፎች',
    'keys.subheading': 'ለፊርማ ማረጋገጫ የሚያገለግሉ ንቁና ያለፉ የክሪፕቶግራፊክ ቁልፎች።',
    'keys.col_kid': 'የቁልፍ መለያ',
    'keys.col_created': 'የተፈጠረበት ቀን',
    'keys.col_status': 'ሁኔታ',
    'keys.col_actions': 'እርምጃዎች',
    'keys.status_active': 'ንቁ',
    'keys.status_expired': 'ጊዜው ያለፈበት',
    'keys.status_revoked': 'የተሰረዘ',
    'keys.btn_change_status': 'ሁኔታ ቀይር',
    'keys.btn_add_key': 'አዲስ ቁልፍ ጨምር',

    // Page 10: Revoke
    'revoke.heading': 'ሰነድ ሰርዝ',
    'revoke.subheading': 'ተቀባይነት እንዳይኖረው የተሰጠን ምስክር ወረቀት ሰርዝ።',
    'revoke.doc_id_label': 'የሰነድ መለያ ቁጥር',
    'revoke.reason_label': 'ምክንያት',
    'revoke.reason_error': 'በስህተት የተሰጠ',
    'revoke.reason_lost': 'የጠፋ መሆኑ የተገለጸ',
    'revoke.reason_forged': 'የተመሰረተ/የተጭበረበረ',
    'revoke.reason_holder': 'በባለቤቱ ጥያቄ',
    'revoke.version_notice': 'የስረዛ ዝርዝር ስሪት {v}፣ ዛሬ የተሻሻለ',
    'revoke.confirm_title': 'ይህን ሰነድ መሰረዝ ይፈልጋሉ?',
    'revoke.confirm_desc': 'ከሚቀጥለው ማመሳሰል በኋላ ሰነዱ እንደተሰረዘ ይታያል።',
    'revoke.btn_confirm': 'ሰነዱን ሰርዝ',
    'revoke.btn_cancel': 'ተመለስ',
    'revoke.success': 'ሰነዱ በተሳካ ሁኔታ ተሰርዟል።',

    // Page 11: Issuers
    'issuers.heading': 'ሰነድ ሰጪ መሥሪያ ቤቶች',
    'issuers.subheading': 'የዋሴኔት ማስረጃዎችን እንዲሰጡ የተፈቀደላቸው እውቅና ያላቸው መሥሪያ ቤቶች።',
    'issuers.col_name': 'የመሥሪያ ቤቱ ስም',
    'issuers.col_code': 'የሰጪ መለያ',
    'issuers.col_status': 'ሁኔታ',
    'issuers.col_actions': 'እርምጃዎች',
    'issuers.status_active': 'ንቁ',
    'issuers.status_disabled': 'የተቋረጠ',
    'issuers.btn_disable': 'አቋርጥ',
    'issuers.btn_enable': 'አንቃ',
    'issuers.btn_add_issuer': 'አዲስ መሥሪያ ቤት ጨምር',

    // Page 12: Sync
    'sync_page.heading': 'የማመሳሰል ሁኔታ',
    'sync_page.subheading': 'የመዝገብ ማመሳሰል እና የክሪፕቶግራፊክ ቁልፎች ወቅታዊነት።',
    'sync_page.last_sync_label': 'የመጨረሻው የተሳካ ማመሳሰል',
    'sync_page.drl_label': 'የስረዛ ዝርዝር ስሪት',
    'sync_page.keys_label': 'የቁልፍ ጥቅል ስሪት',
    'sync_page.btn_sync': 'አሁን አመሳስል',
    'sync_page.offline_reason': 'ለማመሳሰል ከኢንተርኔት ጋር ይገናኙ።',
    'sync_page.synced_just_now': 'አሁን ተመሳስሏል',
    'sync_page.sync_success': 'ማመሳሰሉ በተሳካ ሁኔታ ተጠናቋል።'
  }
};

let currentLang = 'en';

try {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved === 'en' || saved === 'am') {
    currentLang = saved;
  }
} catch (e) {
  // LocalStorage unavailable in restricted environment
}

export function getLanguage() {
  return currentLang;
}

export function setLanguage(lang) {
  if (lang !== 'en' && lang !== 'am') return;
  currentLang = lang;
  try {
    localStorage.setItem(STORAGE_KEY, lang);
  } catch (e) {}
  document.documentElement.lang = lang;
  applyTranslations();
  window.dispatchEvent(new CustomEvent('languagechange', { detail: { lang } }));
}

export function toggleLanguage() {
  setLanguage(currentLang === 'en' ? 'am' : 'en');
}

export function t(key, params = {}) {
  const dict = dictionaries[currentLang] || dictionaries.en;
  let text = dict[key] || dictionaries.en[key] || key;
  for (const [k, v] of Object.entries(params)) {
    text = text.replace(new RegExp(`\\{${k}\\}`, 'g'), v);
  }
  return text;
}

export function applyTranslations(root = document) {
  document.documentElement.lang = currentLang;

  const elements = root.querySelectorAll('[data-i18n]');
  elements.forEach((el) => {
    const key = el.getAttribute('data-i18n');
    if (key) {
      el.textContent = t(key);
    }
  });

  const attrElements = root.querySelectorAll('[data-i18n-attr]');
  attrElements.forEach((el) => {
    const attrSpec = el.getAttribute('data-i18n-attr');
    // Format: "placeholder:key,title:key"
    attrSpec.split(',').forEach((item) => {
      const [attr, key] = item.split(':').map((s) => s.trim());
      if (attr && key) {
        el.setAttribute(attr, t(key));
      }
    });
  });
}

// Auto-run once DOM is ready
if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => applyTranslations());
  } else {
    applyTranslations();
  }
}
