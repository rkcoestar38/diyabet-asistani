# Log Alan Sınırları ve Zamana Duyarlı Bazal Görünürlüğü

## Bağlam ve Karar
Kayıt ekranında her saatte bazal sorulması, kan ketonu kutusunun bulunması ve hipo karbonhidratının genel formda yer alması kafa karışıklığı ve aşırı girdi yükü oluşturuyordu. 

1. **Bazal Görünürlüğü**: Bazal insülin yalnızca `params.basal=1` parametresiyle (doğrudan bazal kaydet butonu) veya kayıt zamanı 20:30 ile 02:00 aralığındayken gösterilir; gündüz ve öğle saatlerinde ana formdan gizlenir.
2. **Ketonların Kaldırılması**: Kan ketonu rutin insülin hesabında yer almadığı ve yalnızca özel tıbbi durumlarda ölçüldüğü için günlük kayıt formundan tamamen kaldırılmıştır.
3. **Hipo Ayrımı**: Hipo takibi yalnızca `/hypo` acil durum sihirbazında yönetilir; genel yemek formundaki "Hipo için alınan KH" alanı kaldırılmıştır.
4. **Tabak / Yemek Senkronizasyonu**: Kayıttan "Yemekleri değiştir" dendiğinde mevcut yemekler sepete aktarılır ve form üzerinde de doğrudan gram düzenleme ve silme desteklenir.
