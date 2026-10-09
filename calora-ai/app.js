/* Calora AI — configure Firebase in firebase-config.js or replace the empty config below.
   Guest mode works without Firebase. AI photo analysis requires the Cloudflare Pages Function and AI binding. */
const FIREBASE_CONFIG = window.CALORA_FIREBASE_CONFIG || {
  apiKey: "PASTE_FIREBASE_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  appId: "PASTE_FIREBASE_APP_ID"
};
const STORE_KEY = "calora_ai_v1";
const PROFILE_KEY = "calora_profile_v1";
const WEIGHT_KEY = "calora_weights_v1";
const $ = (id) => document.getElementById(id);
const todayISO = () => new Date().toLocaleDateString("en-CA");
const dateObj = (iso) => new Date(`${iso}T12:00:00`);
const fmt = (n) => Math.round(Number(n)||0).toLocaleString("en-IN");
const safeNum = (v) => Math.max(0, Number(v)||0);
let meals = [];
let profile = {name:"",age:"",height:"",weight:"",target:"",activity:"1.2",calories:1800,protein:100,carbs:200,fat:60};
let weights = [];
let currentUser = null, db = null, auth = null, authMode = "login", selectedImageData = null, toastTimer = null, activeDiaryDate = todayISO();
let pendingCloudLoad = false;

function loadLocal(){
  try{meals=JSON.parse(localStorage.getItem(STORE_KEY)||"[]");}catch{meals=[]}
  try{profile={...profile,...JSON.parse(localStorage.getItem(PROFILE_KEY)||"{}")};}catch{}
  try{weights=JSON.parse(localStorage.getItem(WEIGHT_KEY)||"[]");}catch{weights=[]}
  if(!Array.isArray(meals))meals=[];
  if(!Array.isArray(weights))weights=[];
}
function persist(){
  localStorage.setItem(STORE_KEY,JSON.stringify(meals));
  localStorage.setItem(PROFILE_KEY,JSON.stringify(profile));
  localStorage.setItem(WEIGHT_KEY,JSON.stringify(weights));
  if(currentUser&&db){
    const payload={meals,profile,weights,updatedAt:firebase.firestore.FieldValue.serverTimestamp()};
    db.collection("caloraUsers").doc(currentUser.uid).set(payload,{merge:true}).catch(e=>{console.error(e);showToast("Saved on this device. Cloud sync failed.");});
  }
}
function initFirebase(){
  if(!window.firebase || !FIREBASE_CONFIG.apiKey || FIREBASE_CONFIG.apiKey.startsWith("PASTE_") || FIREBASE_CONFIG.projectId==="YOUR_PROJECT_ID"){
    $("sync-status").textContent="Guest mode · saved on this device";
    return;
  }
  try{
    if(!firebase.apps.length)firebase.initializeApp(FIREBASE_CONFIG);
    auth=firebase.auth();db=firebase.firestore();
    auth.onAuthStateChanged(async user=>{
      currentUser=user||null;
      if(user){
        $("account-label").textContent=user.displayName||user.email||"My account";
        $("logout-button").classList.remove("hidden");
        $("login-open").classList.add("hidden");$("signup-open").classList.add("hidden");
        $("sync-status").textContent="Signed in · cloud sync enabled";
        try{
          const snap=await db.collection("caloraUsers").doc(user.uid).get();
          if(snap.exists){
            const cloud=snap.data();
            if(cloud.meals)meals=mergeMeals(meals,cloud.meals);
            if(cloud.profile)profile={...profile,...cloud.profile};
            if(cloud.weights)weights=mergeWeights(weights,cloud.weights);
            localStorage.setItem(STORE_KEY,JSON.stringify(meals));
            localStorage.setItem(PROFILE_KEY,JSON.stringify(profile));
            localStorage.setItem(WEIGHT_KEY,JSON.stringify(weights));
          }else{persist();}
        }catch(e){console.error(e);showToast("Signed in, but cloud data could not load. Check Firestore rules.");}
        renderAll();
      }else{
        $("account-label").textContent="Guest user";
        $("logout-button").classList.add("hidden");
        $("login-open").classList.remove("hidden");$("signup-open").classList.remove("hidden");
        $("sync-status").textContent="Guest mode · saved on this device";
      }
    });
  }catch(e){console.error(e);showToast("Firebase setup needs checking. Guest mode still works.");}
}
function mergeMeals(a,b){const map=new Map();[...(Array.isArray(a)?a:[]),...(Array.isArray(b)?b:[])].forEach(m=>{if(m&&m.id)map.set(m.id,m)});return [...map.values()].sort((x,y)=>(x.createdAt||"").localeCompare(y.createdAt||""));}
function mergeWeights(a,b){const map=new Map();[...(Array.isArray(a)?a:[]),...(Array.isArray(b)?b:[])].forEach(w=>{if(w&&w.id)map.set(w.id,w)});return [...map.values()].sort((x,y)=>(x.date||"").localeCompare(y.date||""));}
function showToast(msg){const el=$("toast");el.textContent=msg;el.classList.add("show");clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove("show"),3000)}
function esc(s){return String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
function getDayMeals(date=todayISO()){return meals.filter(m=>m.date===date)}
function sum(items,key){return items.reduce((a,m)=>a+(Number(m[key])||0),0)}
function renderAll(){renderDashboard();renderDiary();renderProgress();fillProfileForm();updateDateLabels();}
function updateDateLabels(){
 const d=new Date();$("today-label").textContent=d.toLocaleDateString("en-US",{weekday:"short",month:"short",day:"numeric"}).toUpperCase();
 $("date-pill").textContent=d.toLocaleDateString("en-US",{weekday:"short",month:"short",day:"numeric"});
}
function renderDashboard(){
 const todays=getDayMeals(),cal=sum(todays,"calories"),goal=Number(profile.calories)||1800,remain=goal-cal,pct=Math.min(100,goal?cal/goal*100:0);
 $("consumed-calories").textContent=fmt(cal);$("consumed-label").textContent=`${fmt(cal)} kcal`;$("goal-label").textContent=`${fmt(goal)} kcal`;$("remaining-label").textContent=`${fmt(Math.max(0,remain))} kcal`;
 $("calorie-ring").style.strokeDashoffset=471.24-(471.24*pct/100);$("goal-progress-line").style.width=`${pct}%`;$("goal-progress-text").textContent=`${Math.round(pct)}% of your daily goal`;
 $("goal-note").textContent=cal===0?"You’ve got this. Log your first meal to get started.":remain>0?`${fmt(remain)} kcal left to reach your daily goal. Keep listening to your body.`:remain===0?"Daily calorie goal reached. Nice work!":`You've logged ${fmt(Math.abs(remain))} kcal above your target. One day doesn't define your progress.`;
 const p=sum(todays,"protein"),c=sum(todays,"carbs"),f=sum(todays,"fat");
 $("protein-total").textContent=`${Math.round(p)} g`;$("carbs-total").textContent=`${Math.round(c)} g`;$("fat-total").textContent=`${Math.round(f)} g`;
 $("protein-bar").style.width=`${Math.min(100,p/(Number(profile.protein)||100)*100)}%`;$("carbs-bar").style.width=`${Math.min(100,c/(Number(profile.carbs)||200)*100)}%`;$("fat-bar").style.width=`${Math.min(100,f/(Number(profile.fat)||60)*100)}%`;
 $("protein-sub").textContent=`of ${fmt(profile.protein||100)} g goal`;$("carbs-sub").textContent=`of ${fmt(profile.carbs||200)} g goal`;$("fat-sub").textContent=`of ${fmt(profile.fat||60)} g goal`;
 $("meal-count").textContent=todays.length;$("recent-meals").innerHTML=renderMealList(todays,true);
}
function renderMealList(items,allowEmpty){
 if(!items.length)return `<div class="empty-state"><div class="empty-emoji">🍽️</div><strong>${allowEmpty?"Your food diary is waiting":"No meals for this date"}</strong><p>${allowEmpty?"Scan a meal or add food manually to start tracking.":"Choose another date or add a meal."}</p><button class="btn btn-soft" data-action="add">Add ${allowEmpty?"your first meal":"food"}</button></div>`;
 return [...items].sort((a,b)=>(b.createdAt||"").localeCompare(a.createdAt||"")).map(m=>`<div class="meal-row"><div class="meal-emoji">${mealEmoji(m.mealType)}</div><div class="meal-info"><strong>${esc(m.name)}</strong><span>${esc(m.mealType||"Meal")} · ${esc(m.portion||"Portion not specified")}</span></div><div class="meal-calories">${fmt(m.calories)} kcal<small>P ${fmt(m.protein)} · C ${fmt(m.carbs)} · F ${fmt(m.fat)} g</small></div><button class="delete-meal" title="Delete meal" aria-label="Delete ${esc(m.name)}" data-delete="${esc(m.id)}">×</button></div>`).join("");
}
function mealEmoji(type){return ({Breakfast:"🥣",Lunch:"🥗",Snacks:"🍎",Dinner:"🍲",Other:"🍽️"})[type]||"🍽️"}
function renderDiary(){
 const date=$("diary-date");if(date.value!==activeDiaryDate)date.value=activeDiaryDate;
 const items=getDayMeals(activeDiaryDate);$("diary-calories").textContent=`${fmt(sum(items,"calories"))} kcal`;$("diary-meals").innerHTML=renderMealList(items,false);
}
function renderProgress(){
 const dates=[...new Set(meals.map(m=>m.date))].sort(),daily=dates.map(date=>({date,cal:sum(getDayMeals(date),"calories")}));
 $("days-tracked").textContent=dates.length;$("goal-days").textContent=daily.filter(d=>d.cal>0&&d.cal<=Number(profile.calories||1800)).length;
 $("average-calories").textContent=daily.length?fmt(daily.reduce((a,d)=>a+d.cal,0)/daily.length):"0";
 const last7=Array.from({length:7},(_,i)=>{const d=new Date();d.setDate(d.getDate()-(6-i));return d.toLocaleDateString("en-CA")});
 const vals=last7.map(date=>({date,cal:sum(getDayMeals(date),"calories")}));
 const max=Math.max(Number(profile.calories)||1800,...vals.map(v=>v.cal),1);
 $("weekly-chart").innerHTML=vals.some(v=>v.cal>0)?vals.map(v=>`<div class="chart-column"><span class="chart-value">${v.cal?fmt(v.cal):"—"}</span><div class="chart-bar ${v.date===todayISO()?"today":""}" style="height:${Math.max(v.cal?3:1,(v.cal/max)*100)}%"></div><span class="chart-day">${dateObj(v.date).toLocaleDateString("en-US",{weekday:"short"})}</span></div>`).join(""):`<div class="empty-chart">Log meals on a few days to see your trend.</div>`;
 const current=Number(profile.weight),target=Number(profile.target);
 $("progress-current-weight").textContent=current?`${current} kg`:"—";$("progress-target-weight").textContent=target?`${target} kg`:"—";
 const start=weights.length?Number(weights[0].weight):current;
 $("progress-weight-change").textContent=(start&&current)?`${current-start>0?"+":""}${(current-start).toFixed(1)} kg`:"—";
 $("weight-history").innerHTML=weights.slice(-6).reverse().map(w=>`<span class="weight-chip">${esc(w.date)} · ${esc(w.weight)} kg</span>`).join("");
}
function fillProfileForm(){
 $("profile-name").value=profile.name||"";$("profile-age").value=profile.age||"";$("profile-height").value=profile.height||"";$("profile-weight").value=profile.weight||"";$("profile-target").value=profile.target||"";
 $("profile-activity").value=profile.activity||"1.2";$("profile-calories").value=profile.calories||1800;$("profile-protein").value=profile.protein??100;$("profile-carbs").value=profile.carbs??200;$("profile-fat").value=profile.fat??60;
}
function switchView(view){
 document.querySelectorAll(".view").forEach(v=>v.classList.toggle("active",v.id===`view-${view}`));
 document.querySelectorAll("[data-view]").forEach(b=>b.classList.toggle("active",b.dataset.view===view));
 if(view==="diary")renderDiary();if(view==="progress")renderProgress();
 window.scrollTo({top:0,behavior:"smooth"});
}
function openModal(id){$(id).classList.remove("hidden");document.body.style.overflow="hidden"}
function closeModal(id){$(id).classList.add("hidden");if(!document.querySelector(".modal-backdrop:not(.hidden)"))document.body.style.overflow=""}
function openFoodModal(){resetFoodForm();openModal("food-modal")}
function resetFoodForm(){
 $("food-form").reset();$("food-protein").value=0;$("food-carbs").value=0;$("food-fat").value=0;
 selectedImageData=null;$("food-image").value="";$("analyze-photo").disabled=true;$("ai-status").textContent="AI estimates can be inaccurate. Review before saving.";
 $("image-preview-wrap").classList.add("hidden");$("upload-prompt").classList.remove("hidden");$("image-preview").src="";
}
function resizeImage(file){
 return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onerror=reject;reader.onload=()=>{const img=new Image();img.onerror=reject;img.onload=()=>{const max=1024,scale=Math.min(1,max/Math.max(img.width,img.height)),canvas=document.createElement("canvas");canvas.width=Math.round(img.width*scale);canvas.height=Math.round(img.height*scale);canvas.getContext("2d").drawImage(img,0,0,canvas.width,canvas.height);resolve(canvas.toDataURL("image/jpeg",.78));};img.src=reader.result;};reader.readAsDataURL(file);});
}
async function handleImage(file){
 if(!file)return;if(!file.type.startsWith("image/")){showToast("Please choose an image file.");return;}
 if(file.size>12*1024*1024){showToast("Please choose an image under 12 MB.");return;}
 try{selectedImageData=await resizeImage(file);$("image-preview").src=selectedImageData;$("image-preview-wrap").classList.remove("hidden");$("upload-prompt").classList.add("hidden");$("analyze-photo").disabled=false;$("ai-status").textContent="Photo ready. Tap Estimate with AI to analyse it.";}catch(e){showToast("Could not read this image. Try another photo.");}
}
async function analyzeImage(){
 if(!selectedImageData)return;
 $("analyze-photo").disabled=true;$("ai-status").textContent="Analysing your meal…";
 try{
  const res=await fetch("/api/analyze",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({image:selectedImageData})});
  const data=await res.json().catch(()=>({}));
  if(!res.ok)throw new Error(data.error||"AI scanner is not configured yet.");
  const food=data.food||data;
  $("food-name").value=food.name||food.food_name||"Meal estimate";
  $("food-calories").value=Math.round(Number(food.calories)||0);
  $("food-protein").value=Math.round((Number(food.protein)||0)*10)/10;
  $("food-carbs").value=Math.round((Number(food.carbs)||0)*10)/10;
  $("food-fat").value=Math.round((Number(food.fat)||0)*10)/10;
  $("food-portion").value=food.portion||food.portion_estimate||"AI portion estimate";
  $("ai-status").textContent=`AI estimate${food.confidence?` · ${food.confidence} confidence`:""}. Check portion size and correct values before saving.`;
  showToast("Estimate ready — please review the values.");
 }catch(e){console.error(e);$("ai-status").textContent=e.message||"AI scanner unavailable. You can enter the food manually.";showToast("AI scan unavailable. Manual entry still works.");}
 finally{$("analyze-photo").disabled=false;}
}
function saveMeal(e){
 e.preventDefault();
 const name=$("food-name").value.trim(),cal=Number($("food-calories").value);
 if(!name||!Number.isFinite(cal)||cal<0){showToast("Please enter a food name and valid calories.");return;}
 const meal={id:crypto.randomUUID?crypto.randomUUID():`${Date.now()}-${Math.random()}`,name,mealType:$("food-meal").value,calories:cal,protein:safeNum($("food-protein").value),carbs:safeNum($("food-carbs").value),fat:safeNum($("food-fat").value),portion:$("food-portion").value.trim(),date:activeDiaryDate||todayISO(),createdAt:new Date().toISOString()};
 meals.push(meal);persist();renderAll();closeModal("food-modal");showToast("Meal added to your diary.");
}
function saveProfile(e){
 e.preventDefault();
 profile={...profile,name:$("profile-name").value.trim(),age:$("profile-age").value,height:$("profile-height").value,weight:$("profile-weight").value,target:$("profile-target").value,activity:$("profile-activity").value,calories:Math.min(5000,Math.max(1000,Number($("profile-calories").value)||1800)),protein:safeNum($("profile-protein").value),carbs:safeNum($("profile-carbs").value),fat:safeNum($("profile-fat").value)};
 persist();renderAll();$("profile-save-status").textContent="Goals saved.";showToast("Your goals have been saved.");
}
function suggestGoal(){
 const age=Number(profile.age||$("profile-age").value),height=Number(profile.height||$("profile-height").value),weight=Number(profile.weight||$("profile-weight").value),activity=Number($("profile-activity").value||1.2);
 if(!age||!height||!weight){$("goal-suggestion").textContent="Enter age, height and weight first. This estimate needs those details.";return;}
 // Mifflin-St Jeor needs sex at birth; avoid silently assuming. Present a broad range instead.
 const base=(10*weight+6.25*height-5*age)*activity;
 const low=Math.max(1200,Math.round((base-250)/50)*50),high=Math.max(low,Math.round((base+150)/50)*50);
 $("goal-suggestion").textContent=`A rough maintenance/gradual-change starting range could be around ${fmt(low)}–${fmt(high)} kcal/day, but this is not a personalised medical prescription. Formula estimates vary; consider a registered dietitian, especially if you have a medical condition. Review and set your preferred target above.`;
}
function saveWeight(e){
 e.preventDefault();const value=Number($("weight-entry").value);if(!value||value<20||value>500){showToast("Enter a valid weight in kg.");return;}
 profile.weight=value;weights.push({id:crypto.randomUUID?crypto.randomUUID():String(Date.now()),date:todayISO(),weight:value});persist();renderAll();$("weight-entry").value="";showToast("Weight entry saved.");
}
function exportData(){
 const blob=new Blob([JSON.stringify({exportedAt:new Date().toISOString(),meals,profile,weights},null,2)],{type:"application/json"});const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download=`calora-backup-${todayISO()}.json`;a.click();URL.revokeObjectURL(url);showToast("Your data backup is ready.");
}
async function clearData(){
 if(!confirm("Clear this device's Calora data? This cannot be undone on this device. Cloud data, if any, is not deleted by this action."))return;
 meals=[];weights=[];localStorage.removeItem(STORE_KEY);localStorage.removeItem(WEIGHT_KEY);persist();renderAll();showToast("Local diary cleared.");
}
function setAuthMode(mode){
 authMode=mode;$("auth-title").textContent=mode==="signup"?"Create your Calora account":"Welcome to Calora";
 $("auth-description").textContent=mode==="signup"?"Create an account to sync your diary across devices.":"Log in to sync your food diary securely.";
 $("auth-submit").textContent=mode==="signup"?"Create account":"Log in";
 $("auth-switch-label").textContent=mode==="signup"?"Already have an account?":"New to Calora?";
 $("auth-switch").textContent=mode==="signup"?"Log in":"Create an account";$("auth-error").textContent="";
 $("auth-password").autocomplete=mode==="signup"?"new-password":"current-password";
}
async function handleAuth(e){
 e.preventDefault();$("auth-error").textContent="";
 if(!auth){$("auth-error").textContent="Firebase is not configured yet. Guest mode is ready; add your Firebase config to enable accounts.";return;}
 const email=$("auth-email").value.trim(),password=$("auth-password").value;
 try{if(authMode==="signup")await auth.createUserWithEmailAndPassword(email,password);else await auth.signInWithEmailAndPassword(email,password);closeModal("auth-modal");showToast(authMode==="signup"?"Account created. Cloud sync is on.":"Welcome back!");}
 catch(err){$("auth-error").textContent=err.message.replace("Firebase: ","");}
}
function bindEvents(){
 document.querySelectorAll("[data-view]").forEach(b=>b.addEventListener("click",()=>switchView(b.dataset.view)));
 $("settings-shortcut").addEventListener("click",()=>switchView("profile"));
 $("open-scanner").addEventListener("click",openFoodModal);$("manual-add").addEventListener("click",openFoodModal);$("add-meal-button").addEventListener("click",openFoodModal);$("empty-add").addEventListener("click",openFoodModal);$("diary-add").addEventListener("click",openFoodModal);
 $("choose-photo").addEventListener("click",()=>$("food-image").click());$("food-image").addEventListener("change",e=>handleImage(e.target.files[0]));$("analyze-photo").addEventListener("click",analyzeImage);$("food-form").addEventListener("submit",saveMeal);
 document.querySelectorAll("[data-close]").forEach(b=>b.addEventListener("click",()=>closeModal(b.dataset.close)));
 document.querySelectorAll(".modal-backdrop").forEach(back=>back.addEventListener("click",e=>{if(e.target===back)closeModal(back.id)}));
 document.addEventListener("keydown",e=>{if(e.key==="Escape")document.querySelectorAll(".modal-backdrop:not(.hidden)").forEach(m=>closeModal(m.id))});
 $("diary-date").value=activeDiaryDate;$("diary-date").addEventListener("change",e=>{activeDiaryDate=e.target.value||todayISO();renderDiary()});
 $("profile-form").addEventListener("submit",saveProfile);$("suggest-goal").addEventListener("click",suggestGoal);$("weight-entry-form").addEventListener("submit",saveWeight);
 $("export-data").addEventListener("click",exportData);$("clear-data").addEventListener("click",clearData);
 $("login-open").addEventListener("click",()=>{setAuthMode("login");openModal("auth-modal")});$("signup-open").addEventListener("click",()=>{setAuthMode("signup");openModal("auth-modal")});$("account-button").addEventListener("click",()=>{if(currentUser)switchView("profile");else{setAuthMode("login");openModal("auth-modal")}});
 $("auth-switch").addEventListener("click",()=>setAuthMode(authMode==="signup"?"login":"signup"));$("auth-form").addEventListener("submit",handleAuth);
 $("logout-button").addEventListener("click",async()=>{if(auth)try{await auth.signOut();showToast("Logged out. Your local data remains on this device.");}catch(e){showToast("Could not log out.");}});
 document.addEventListener("click",e=>{const del=e.target.closest("[data-delete]");if(del){const id=del.dataset.delete;if(confirm("Remove this meal from your diary?")){meals=meals.filter(m=>m.id!==id);persist();renderAll();showToast("Meal removed.");}}const add=e.target.closest('[data-action="add"]');if(add)openFoodModal();});
}
loadLocal();bindEvents();initFirebase();renderAll();
if("serviceWorker" in navigator && location.protocol.startsWith("http"))window.addEventListener("load",()=>navigator.serviceWorker.register("/sw.js").catch(()=>{}));
