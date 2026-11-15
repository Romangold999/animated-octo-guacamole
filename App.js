import React, {useCallback,useEffect,useMemo,useRef,useState} from 'react';
import {SafeAreaView,View,Text,FlatList,Image,Pressable,TextInput,ActivityIndicator,StyleSheet,Linking,StatusBar} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {WebView} from 'react-native-webview';
const QUERIES=['скидки','распродажа','товары для дома','одежда','обувь','электроника','косметика','детские товары','спорт','мебель'];
const KEY='@wb_skidki_products_v1', THRESHOLD=50, SCAN_DELAY=25000;
const COLLECTOR = \`(function(){if(window.__wbSkidkiInstalled)return true;window.__wbSkidkiInstalled=true;
function price(el){return el?Number((el.innerText||el.textContent||'').replace(/[^0-9]/g,''))||0:0;}
function scan(){var out=[];document.querySelectorAll('article.product-card,article[data-nm-id],.product-card').forEach(function(c){
var a=c.querySelector('a[href*="/catalog/"]'),href=a&&a.href||'',m=href.match(/catalog\\/(\\d+)/)||String(c.getAttribute('data-nm-id')||'').match(/(\\d+)/);if(!m)return;
var now=price(c.querySelector('ins,.price__lower-price,.price__wrap ins,[class*=price] ins')),old=price(c.querySelector('del,.price__wrap del,[class*=price] del'));if(!now||!old||old<=now)return;
var d=Math.round((old-now)*100/old);if(d<=50)return;var img=c.querySelector('img');
out.push({nmId:m[1],name:((c.querySelector('[class*=product-card__name],.goods-name,h2')||{}).innerText||c.innerText||'Товар').trim().slice(0,180),
brand:((c.querySelector('[class*=product-card__brand],.brand-name')||{}).innerText||'').trim().slice(0,80),salePrice:now,originalPrice:old,discountPercent:d,
rating:((c.querySelector('[class*=rating]')||{}).innerText||'').trim().slice(0,20),reviews:((c.querySelector('[class*=feedback],[class*=review]')||{}).innerText||'').trim().slice(0,30),
imageUrl:img?(img.src||img.dataset.src||''):'',productUrl:'https://www.wildberries.ru/catalog/'+m[1]+'/detail.aspx'});});
if(out.length&&window.ReactNativeWebView)window.ReactNativeWebView.postMessage(JSON.stringify({type:'WB_PRODUCTS',items:out}));}
scan();window.__wbSkidkiTimer=setInterval(scan,3500);return true;})();true;\`;
export default function App(){
const web=useRef(null),seen=useRef(new Set()),runningRef=useRef(false);
const [products,setProducts]=useState([]),[running,setRunning]=useState(false),[queryIndex,setQueryIndex]=useState(0),[loading,setLoading]=useState(false),[browserOpen,setBrowserOpen]=useState(false),[search,setSearch]=useState(''),[lastScan,setLastScan]=useState('Пока не сканировали'),[status,setStatus]=useState('Готово к запуску');
useEffect(()=>{(async()=>{try{let raw=await AsyncStorage.getItem(KEY);if(raw){let a=JSON.parse(raw);setProducts(a);a.forEach(p=>seen.current.add(String(p.nmId)));}}catch(e){}})();},[]);
const go=useCallback(i=>{let u='https://www.wildberries.ru/catalog/0/search.aspx?search='+encodeURIComponent(QUERIES[i%QUERIES.length]);web.current?.injectJavaScript('window.location.href='+JSON.stringify(u)+';true;');},[]);
const onMessage=useCallback(async e=>{try{let m=JSON.parse(e.nativeEvent.data);if(m.type!=='WB_PRODUCTS'||!Array.isArray(m.items))return;let fresh=[];
m.items.forEach(p=>{let id=String(p.nmId||''),old=Number(p.originalPrice),now=Number(p.salePrice),d=old>0?Math.round((old-now)*100/old):0;
if(!/^\\d{5,}$/.test(id)||!p.productUrl?.startsWith('https://www.wildberries.ru/catalog/')||!now||!old||d<=THRESHOLD||seen.current.has(id))return;
seen.current.add(id);fresh.push({...p,discountPercent:d,foundAt:Date.now()});});
if(fresh.length)setProducts(prev=>{let next=[...fresh,...prev].slice(0,500);AsyncStorage.setItem(KEY,JSON.stringify(next)).catch(()=>{});return next;});
setStatus(fresh.length?'Новых находок: '+fresh.length:'Проверка завершена');setLastScan(new Date().toLocaleTimeString());setLoading(false);
}catch(e){}},[]);
useEffect(()=>{runningRef.current=running;if(running){setStatus('Сканирование активно');setLoading(true);go(queryIndex);}else{setStatus('Сканирование остановлено');setLoading(false);}},[running]);
useEffect(()=>{if(!running)return;let t=setInterval(()=>{let n=(queryIndex+1)%QUERIES.length;setQueryIndex(n);setLoading(true);go(n);},SCAN_DELAY);return()=>clearInterval(t);},[running,queryIndex,go]);
const clear=()=>{setProducts([]);seen.current.clear();AsyncStorage.removeItem(KEY).catch(()=>{});};
const filtered=useMemo(()=>products.filter(p=>(p.name+' '+p.brand).toLowerCase().includes(search.toLowerCase())),[products,search]);
const item=({item:p})=><Pressable style={s.card} onPress={()=>Linking.openURL(p.productUrl)}>
{p.imageUrl?<Image source={{uri:p.imageUrl}} style={s.image}/>:<View style={[s.image,s.noImage]}><Text>WB</Text></View>}
<View style={s.info}><Text style={s.brand}>{p.brand||'Wildberries'}</Text><Text numberOfLines={2} style={s.name}>{p.name}</Text>
<View style={s.prices}><Text style={s.price}>{Number(p.salePrice).toLocaleString('ru-RU')} ₽</Text><Text style={s.old}>{Number(p.originalPrice).toLocaleString('ru-RU')} ₽</Text></View>
<Text style={s.discount}>−{p.discountPercent}%</Text>{!!(p.rating||p.reviews)&&<Text style={s.meta}>★ {p.rating||'—'} · {p.reviews||'Отзывы'}</Text>}
<Text style={s.open}>Открыть на Wildberries ↗</Text></View></Pressable>;
return <SafeAreaView style={s.root}><StatusBar barStyle="dark-content" backgroundColor="#fff"/>
<View style={s.header}><View><Text style={s.logo}>WB Скидки</Text><Text style={s.sub}>Находки со скидкой больше 50%</Text></View><View style={s.counter}><Text style={s.counterNum}>{products.length}</Text><Text style={s.counterLabel}>найдено</Text></View></View>
<View style={s.controls}><Pressable style={[s.action,running?s.stop:s.start]} onPress={()=>setRunning(v=>!v)}><Text style={s.actionText}>{running?'Остановить':'Начать сканирование'}</Text></Pressable><Pressable style={s.secondary} onPress={()=>setBrowserOpen(v=>!v)}><Text style={s.secondaryText}>{browserOpen?'Скрыть WB':'Показать WB'}</Text></Pressable></View>
<View style={s.status}><View style={[s.dot,{backgroundColor:running?'#16a34a':'#9ca3af'}]}/><Text style={s.statusText}>{status} · {lastScan}</Text>{loading&&<ActivityIndicator size="small" color="#6d28d9"/>}</View>
<View style={[s.webWrap,{height:browserOpen?180:1,opacity:browserOpen?1:0.01}]}><WebView ref={web} source={{uri:'https://www.wildberries.ru/catalog/0/search.aspx?search='+encodeURIComponent(QUERIES[queryIndex])}} onMessage={onMessage} onLoadEnd={()=>web.current?.injectJavaScript(COLLECTOR)} javaScriptEnabled domStorageEnabled thirdPartyCookiesEnabled sharedCookiesEnabled setSupportMultipleWindows={false}/></View>}
<View style={s.listHeader}><Text style={s.section}>Найденные товары</Text><Pressable onPress={clear}><Text style={s.clear}>Очистить</Text></Pressable></View>
<TextInput value={search} onChangeText={setSearch} placeholder="Поиск по найденным товарам" placeholderTextColor="#9ca3af" style={s.search}/>
<FlatList data={filtered} keyExtractor={p=>String(p.nmId)} renderItem={item} contentContainerStyle={s.list} ListEmptyComponent={<View style={s.empty}><Text style={s.emptyTitle}>Пока нет находок</Text><Text style={s.emptyText}>Нажмите «Начать сканирование». Сайт проверяется в течение открытой сессии приложения.</Text></View>}/>
<Text style={s.footer}>Сканирование работает, пока приложение открыто. CAPTCHA и защиту Wildberries приложение не обходит.</Text></SafeAreaView>;
}
const s=StyleSheet.create({root:{flex:1,backgroundColor:'#f5f5f7'},header:{paddingHorizontal:18,paddingTop:12,paddingBottom:14,backgroundColor:'#fff',flexDirection:'row',justifyContent:'space-between',alignItems:'center'},logo:{fontSize:25,fontWeight:'900',color:'#231942'},sub:{fontSize:12,color:'#6b7280',marginTop:3},counter:{alignItems:'center',backgroundColor:'#f1eafe',paddingHorizontal:15,paddingVertical:7,borderRadius:13},counterNum:{fontSize:21,fontWeight:'800',color:'#6d28d9'},counterLabel:{fontSize:10,color:'#6d28d9'},controls:{flexDirection:'row',padding:12,gap:8},action:{flex:1,padding:13,borderRadius:12,alignItems:'center'},start:{backgroundColor:'#6d28d9'},stop:{backgroundColor:'#b42318'},actionText:{color:'#fff',fontWeight:'800'},secondary:{paddingHorizontal:14,justifyContent:'center',backgroundColor:'#fff',borderRadius:12},secondaryText:{fontWeight:'700',color:'#374151'},status:{marginHorizontal:12,marginBottom:8,backgroundColor:'#fff',borderRadius:10,padding:10,flexDirection:'row',alignItems:'center',gap:7},dot:{width:8,height:8,borderRadius:4},statusText:{fontSize:11,color:'#4b5563',flex:1},webWrap:{height:180,marginHorizontal:12,marginBottom:8,borderRadius:12,overflow:'hidden'},listHeader:{paddingHorizontal:16,paddingTop:8,paddingBottom:6,flexDirection:'row',justifyContent:'space-between',alignItems:'center'},section:{fontSize:18,fontWeight:'800',color:'#1f2937'},clear:{color:'#7c3aed',fontWeight:'700'},search:{marginHorizontal:12,marginBottom:8,paddingHorizontal:13,paddingVertical:10,backgroundColor:'#fff',borderRadius:10,color:'#111827'},list:{paddingHorizontal:12,paddingBottom:12},card:{backgroundColor:'#fff',borderRadius:14,marginBottom:9,padding:10,flexDirection:'row',gap:11},image:{width:104,height:126,borderRadius:9,backgroundColor:'#f3f4f6'},noImage:{alignItems:'center',justifyContent:'center'},info:{flex:1},brand:{fontSize:11,color:'#7c3aed',fontWeight:'700'},name:{fontSize:13,color:'#111827',fontWeight:'600',marginTop:3},prices:{flexDirection:'row',alignItems:'center',gap:8,marginTop:7},price:{fontSize:17,fontWeight:'900',color:'#111827'},old:{fontSize:12,color:'#9ca3af',textDecorationLine:'line-through'},discount:{alignSelf:'flex-start',marginTop:5,backgroundColor:'#dcfce7',color:'#15803d',fontWeight:'900',paddingHorizontal:8,paddingVertical:3,borderRadius:6},meta:{fontSize:11,color:'#6b7280',marginTop:5},open:{fontSize:11,color:'#6d28d9',fontWeight:'700',marginTop:7},empty:{alignItems:'center',padding:35},emptyTitle:{fontSize:17,fontWeight:'800',color:'#374151'},emptyText:{textAlign:'center',color:'#6b7280',lineHeight:20,marginTop:8},footer:{fontSize:10,color:'#9ca3af',textAlign:'center',padding:8}});
