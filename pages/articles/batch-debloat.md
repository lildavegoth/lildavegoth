---
title: "Batch Debloat"
date: "2026-05-22"
image: "images/batchdeb.webp"
author: "lildavegoth"
profile: "https://t.me/lildavegoth"
description: "Still using Debloater apps and modules? Why bother restarting your device to uninstall system apps when you can do it just by copy and paste text? Restart device after Debloating apps is unnecessary, but..."
categories: "Tutorials, App, Useful"
---

Still using Debloater apps and modules? Why bother restarting your device to uninstall system apps when you can do it just by copy and paste text?

Restart device after Debloating apps is unnecessary, but when you use a **Magisk** module to Debloat system apps, of course you need to reboot your device to make the module run and activated.

# Methods
Choose your own methods for the tutorials
`[Method One — Terminal Emulator](^^^method1show^^^)`
`[Method Two — App Manager](^^^method2show^^^)`

^^^method1hide^^^
# Method One →
But you know what? You can Debloat apps just by copy a bunch of commands and paste it to **Terminal Emulator** apps. All the system apps in the commands will be gone from your face in a seconds!

I've been write them down below for you, so you don't have to bother making it yourself.
# Basic Lesson →
```
pm uninstall -k --user 0 package name
```
That is the basic command that used for Debloating apps, it works in any android versions. Confused? Here's the example for uninstall a **MIUI Theme Manager** app:
```
pm uninstall -k --user 0 com.android.thememanager
```
It's pretty simple right? you just need the basic command, and the package name of the app, that's all. Some people just too lazy to do it so they using magisk modules, but with this method, you can add or remove the app by your own choices.
# Guides →
> **Uninstall**

1. Make sure you have root access
2. Copy commands
3. Open any terminal emulators (I suggest use Rootify, cause it's the smallest terminal emulator ever)
4. Paste the commands to terminal input
5. Click Run, wait a seconds and your system apps will be gone

> **Reinstall**

1. If you want to install them back:
2. Install Lucky Patcher app
3. Search by type the app name in the search bar
4. Select the app
5. Click Install App for user

> [!fas fa-warning] Warning
> Use this only to install the app that already uninstalled, and don't Debloat any system app using **Lucky Patcher**, cause it's unsafe. Lucky Patcher using magisk module to Debloat apps, but it was like an experimental features, so be careful with it.

^^^method1hide^^^

^^^method2hide^^^
# Method 2 →
The second Method is using App Manager by Muntashir Al-Islam, this method are way more different but more easier.
# Guides →
> **App Setup**

1. Download [App Manager](https://github.com/MuntashirAkon) from GitHub Releases
2. Install the app as usual, and open it after completed installation
3. Give all permissions the asked and if you see a popup of Backup Volume just click close for now

> **Uninstall**

1. Let's Uninstall or Debloat the system apps, inside the app, you'll see 3 dots button on top right corner of the screen, click it
2. Click **Debloater** menu, the app will loads all apps that can be Debloated
3. **Don't** do Debloat apps yet! You must know this first:
	- There's 3 Types of system apps debloat list: **Safe**, **Replace**, **Caution**
	- Do Debloat apps of **Safe** and **Replace** only! But still be careful with **Replace** types, some of them may break the system or has a hard apps that system really needed
	- You can choose the **Types** by click on the **Filter** icon on the top right corner of the screen (next to **Search** icon), and then selects the **Types** that you want to use also unselect the **Types** of ehat you don't want to use
4. After selecting **Types**, you'll be able to do Debloat now, select one app on the list and then click **Select All** to select all the apps on the list
5. If all apps has been selected, click **Uninstall** button to start Debloat

If there's any apps that you might use but has been Debloated, don't worry because you can ReInstall them back!

> **Reinstall**

1. Still using **App Manager**, search your wanted apps
2. Click the app on the list
3. There's a popup appear after you click the app with some buttons:
	- **App Info**, **Cancel** and **Reinstall**
4. Of course you need to click **Reinstall** button to Reinstall the app again
5. Wait for it to completed installed, and you'll be able to use the app again
^^^method2hide^^^

# Not Recommended →
Some apps that doesn't recommend to be Debloated
- Downloads Manager: com.android.providers.downloads | com.android.providers.downloads.ui [Causing Media Picker crashed when moving, copying, deleting files to or from Download folder]
- MIUI Find Device: com.xiaomi.finddevice [Will be so many popups that telling your device is broken or something]
- Apps Storages [Causing crashed to apps that needs permissions from above apps]
- Calendar: com.android.providers.calendar
- Contacts: com.android.providers.contacts
- Media: com.google.android.providers.media.module | com.android.providers.media
- Phone & Messaging: com.android.providers.telephony
# Notes →
If your device forced rebooted to recovery and got a “rescue_party” message on logs, you uninstalled the wrong app that system needed it, uninstall magisk to fix (Use tools from your custom recovery or, use **Magisk Uninstaller** file)