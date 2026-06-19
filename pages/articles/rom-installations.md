---
title: "ROM Installations"
date: "2022-05-16"
image: "images/rom-installations.webp"
author: "lildavegoth"
profile: "https://t.me/lildavegoth"
description: "This Article will guides you how to Install any custom ROMs with detailed and correct way, and it's also included..."
categories: "ROMs, Tutorials"
---
This Article will guides you how to Install any custom ROMs with detailed and correct way, and it's also included how to Decrypt any ROMs.

# Guides & Stuff →
- `[ROM Installations](^^^install1show^^^)`
- `[Decrypt ROMs](^^^decrypt1show^^^)`
- `[Needed Files](^^^needed1show^^^)`
- `[Other Stuff](^^^other1show^^^)`

^^^install1hide^^^
# ROM Installations →
**Basic Clean Flash**
1. Wipe first (Data, Dalvik, Cache) or Format Data
2. Flash latest Firmware (If needed)
3. Flash ROM
4. Convert to Read Write (If needed)
5. Reboot recovery
6. Flash DFE (Disable Force Encryption)
7. Reboot system

---

**Clean Flash from Android 11/12 OSS ROMs to Android 10 Non-OSS**
1. Wipe first (Data, Dalvik, Cache) or Format Data
2. Flash latest MIUI Android 10 (Below 12.0.9 versions)
3. Flash ROM (After install MIUI Android 10)
4. Convert to Read Write (If needed)
5. Reboot recovery
6. Flash DFE (Disable Force Encryption)
7. Reboot system

---

**Clean Flash from Android 10 Non-OSS to Android 11/12 OSS ROMs**
1. Wipe first (Data, Dalvik, Cache) or Format Data
2. Flash latest Firmware (If needed)
3. Flash ROM
4. Convert to Read Write (If needed)
5. Reboot recovery
6. Flash DFE (Disable Force Encryption)
7. Reboot system

---

**Clean Flash from Android 10,11,12 to Android 13 ROMs**
1. Flash recovery that supports FBEV2 (Skip if already installed)
2. Wipe first (Data, Dalvik, Cache) or Format Data
3. Flash latest Firmware (MIUI 13 Firmware)
4. Convert to Read Write (If needed)
5. Reboot recovery
6. Flash dynDFE (Disable Force Encryption)
7. Reboot system

---

**Clean Flash from Android 13 to Android 10, 11, 12 ROMs**
1. Flash a recovery that NOT support for FBEV2
2. Wipe first (Data, Dalvik, Cache) or Format Data
3. Flash latest Firmware (If needed)
4. Flash ROM
5. Convert to Read Write (If needed)
6. Reboot recovery
7. Flash DFE (Disable Force Encryption)
8. Reboot system

---

**MIUI Android 10 to Android 11/12 or from Android 11/12 to Android 10**
1. Use basic clean flash (Scroll to the top)
2. Skip flash Firmware

^^^install1hide^^^

^^^decrypt1hide^^^
# Decrypt ROMs →
This is how you can Decrypt any ROMs

**Notes**
- This guide is to fix random name on Recovery
- This guide is only tested on twrp 3.6.0 10-1 (By myself)
- Read carefully step by step, it's your fault if you skip the guide steps
- First, make sure that your system ROM is already Read Write (Read More Details below)

**More Details**
- **DFE** (Disable Force Encryption): Flashable file to make system storage decrypted
- **How to make sure the system rom is Read Write**: Download DFE file or use from TWRP Advanced Menu and flash it on Recovery, if an error appears, it means the rom you are using is not r/w
- **How to convert ROM to Read Write**: Go to Advanced Menu on TWRP and choose convert ROM, wait the process, then you MUST to reboot recovery

---

**Guide for ROM not Read Write**
1. Format data first (MUST format data)
2. Convert rom to r/w (read more details for how to convert the rom)
3. Reboot Recovery (MUST reboot Recovery to refresh the system)
4. Flash DFE (Disable Force Encryption)
5. Reboot system

**Guide for ROM already in Read Write**
1. Format data first (MUST format data)
2. Flash DFE (Disable Force Encryption)
3. Reboot system

^^^decrypt1hide^^^

^^^needed1hide^^^
# Needed Files →
Some files that you might needed
- [TWRP FBEV2](https://www.pling.com/p/1896487/)
- [Orange Fox FBEV2](https://www.pling.com/p/1751205/)
- dynDFE: [01](https://t.me/PocoX3Discussions/779994) / [02](https://t.me/PocoX3ID/1324005)

^^^needed1hide^^^

^^^other1hide^^^
# Difference →
- Dirty Flash: Flash ROM, Reboot system
- Clean Flash: Wipe, Flash ROM, Reboot system

# Details →
- **Convert to Read Write means**: To make the system to be Read Write, so u can add or remove files on system root folder
- **Convert to Read Write**: Convert to Read Write is the feature in latest TWRP

# Notes →
- **Recovery FBEV2**: Only use this recovery for supported ROMs
- **Avoid stuck on Recovery**: Always delete storage.xml file before reboot system, Path: data/system/storage.xml (Only if needed in Old ROMs)
- **Decrypt**: don't forget to flash dfe after flash rom if your device is decrypted, even if you just doing dirty flash
- **MIUI Flash**: Use Basic Clean Flash step
- **Magisk**: Always flash Magisk after boot to the system (Lock screen or Home screen)