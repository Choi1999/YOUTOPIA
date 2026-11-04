import {defineConfig,devices} from "@playwright/test";
export default defineConfig({
 testDir:"./e2e",testMatch:"demo-polish.spec.ts",outputDir:"test-results/demo-polish/artifacts",fullyParallel:false,workers:1,retries:0,forbidOnly:true,timeout:30000,
 reporter:[["list"],["json",{outputFile:"test-results/demo-polish/results.json"}]],
 use:{baseURL:"http://127.0.0.1:4175",trace:"retain-on-failure",screenshot:"only-on-failure"},
 webServer:{command:"pnpm exec vite preview --host 127.0.0.1 --strictPort --port 4175",url:"http://127.0.0.1:4175",reuseExistingServer:false},
 projects:[{name:"desktop",grepInvert:/모바일/,use:{...devices["Desktop Chrome"]}},{name:"mobile",grep:/모바일/,use:{...devices["Pixel 7"]}}]
});
