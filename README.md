# 🚽 TheVR Jani BudiCheck

> **TheVR Jani legendás budi checkjeinek archívuma, rangsora, közösségi szavazása és kvízjátéka.**

A TheVR videókban (főleg a horrorjátékok és végigjátszások során) Jani szinte minden budit alaposan szemügyre vesz: megnézi, hogy lehúzható-e a vécé, van-e vécépapír, tiszta-e a fülke, majd ad rá egy pontszámot (pl. *„Erre jó szívvel adok egy 4 és felet”*).

A **TheVR Jani BudiCheck** egy modern webalkalmazás, ami automatikusan kigyűjti, rendszerezi és játszhatóvá teszi ezeket a pillanatokat.

---

## ✨ Funkciók

- 🏆 **TheVR Jani BudiCheck Rangsor & Szűrők**: Kereshető, szűrhető adatbázis pontszám (Istenkirály trón, Nagyon jó, Korrekt budi, Elfogadható, Retkes, Nagyon gáz, Katasztrófa), játék és kulcsszó szerint.
- 🎮 **Budi Kvíz (Tippeld meg a pontot!)**: Nézd meg a videót, és tippeld meg, hány pontot adott rá Jani, mielőtt elhangzana az ítélet! Szavazz te is, és hasonlítsd össze a közösségi átlaggal.
- 📊 **Tier List & Kártya nézet**: Vizuális tier list nézet (S-től F kategóriáig) pillanatképekkel és közösségi rangsorral.
- 🎬 **Közvetlen YouTube beágyazás**: Egy kattintással megnyitható a videó a budi check pontos másodpercétől.
- 🔍 **Automatizált videóelemző & Audit**: Felirat és hang alapján Gemini AI modellekkel megkeresi a budi checkeket, kiszűri a különálló csapokat/kádakat, és kivágja a képernyőképeket.
- 🛡️ **Admin felület**: Beépített vezérlőpult a kereső indításához, pontszámok szerkesztéséhez, auditálásához és az archívum kezeléséhez.

---

## 🚀 Gyors indítás

### 1. Előfeltételek
- Python 3.10+
- Node.js 18+ (csak fejlesztéshez; az előre lefordított frontend a csomag része a `frontend/dist/` mappában)

### 2. Telepítés

```bash
# Függőségek telepítése
pip install -r requirements.txt
```

### 3. Konfiguráció (opcionális)
Másold le a példa konfigot:
```bash
cp data/config.example.json data/config.json
```
Ha szeretnéd használni az automatikus videóelemzőt és visszaellenőrzést, add meg a [Google AI Studio](https://aistudio.google.com/)-ban generált ingyenes Gemini API kulcsodat a vezérlőpulton, a `data/config.json`-ban vagy `.env`-ben:
```env
GEMINI_API_KEY=a_te_api_kulcsod
```

### 4. Indítás

```bash
python run_app.py
```

A szerver elindul a `http://127.0.0.1:8000` címen és automatikusan megnyitja a böngészőt.

---

## 🛠️ Technikai részletek

- **Backend**: FastAPI (Python), yt-dlp, ffmpeg
- **Frontend**: React 19, Vite, Lucide ikonok, modern Cyberpunk/Dark UI
- **AI / Feldolgozás**: Google Gemini (Flash modellek) + YouTube felirat- és fejezetfeldolgozó
- **Adattárolás**: Könnyűsúlyú JSON adatbázis (`data/budicheck.json`) és helyi képernyőkép gyorsítótár

---

## 📜 Licenc & Jogi nyilatkozat

Ez egy nem-hivatalos rajongói projekt, amely tiszteletből és szórakozásból készült a **TheVR** közösség számára. Minden videós tartalom és jog a TheVR csapatát illeti.

