UJ AI v3.2.12 ko apne existing GitHub repository me update karne ke liye:

1. ZIP ko extract karein.
2. Extract hui folder ke ANDAR ki sabhi files/folders (hidden .github folder samet) ko apne repository ke root me upload karein.
3. GitHub par existing files replace/overwrite karein. Naye folders/files bhi upload hon.
4. Commit changes karein.
5. GitHub repository me Actions tab kholein.
6. "Build UJ AI Android APK" workflow select karke Run workflow dabayein.
7. Build successful hone par run ke Artifacts section se "UJ-AI-debug-APK" download karein.

Note: ZIP file ko repository me sirf ek ZIP ke roop me upload karne se workflow run nahi hoga. ZIP extract karke uske andar ka project root repository me update karna zaroori hai.

Is package me source code aur APK build workflow hai; pehle se bana hua APK nahi hai. APK tabhi milega jab GitHub Actions build successful ho.
