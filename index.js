const TeleBot = require('telebot');
const PORT = process.env.PORT
const bot = new TeleBot({
    token: '', //Token generated with Botfather
    webhook: {
        url: 'https://botname.herokuapp.com', // url of the Heroku server, where the bot is hosted
        host: '0.0.0.0',
        port: PORT
    }
});

// Initialization of the variables for the last visited menu item and generated list of nearby locations for each chat
let chatStatus;
let nearbyStatus;

//Connecting to Postgre Database
const { Client } = require('pg');

const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

client.connect();

// On start getting all chat statuses and assigning it to the chatStatus variable 
client
  .query('SELECT jsonname,jsontext FROM public.jsons WHERE jsonname = \'chatstatus\'')
  .then(result => {
    chatStatus = result.rows[0].jsontext;
    console.log(chatStatus);
  })  
  .catch(e => console.error(e.stack))

  // On start getting all locations nearby created for clients and assigning it to the nearbyStatus variable 
client
  .query('SELECT jsonname,jsontext FROM public.jsons WHERE jsonname = \'nearbystatus\'')
  .then(result => {
    nearbyStatus = result.rows[0].jsontext;
    console.log(nearbyStatus);
  })  
  .catch(e => console.error(e.stack))


  //Functions to write chat statuses and nearby locations to DB
let writeChatStatus = () => {
    console.log('INSERT INTO public.jsons (jsonname, jsontext) VALUES (\'chatstatus\'::text, \'' + JSON.stringify(chatStatus) + '\'::json)');
    client.query('INSERT INTO public.jsons (jsonname, jsontext) VALUES (\'chatstatus\'::text, \'' + JSON.stringify(chatStatus) + '\'::json) ON CONFLICT (jsonname) DO UPDATE SET jsontext = EXCLUDED.jsontext;', (err, res) => {
        if (err) throw err;
      });
}

let writeNearbyStatus = () => {
    client.query('INSERT INTO public.jsons (jsonname, jsontext) VALUES (\'nearbystatus\'::text, \'' + JSON.stringify(nearbyStatus) + '\'::json)ON CONFLICT (jsonname) DO UPDATE SET jsontext = EXCLUDED.jsontext;', (err, res) => {
        if (err) throw err;
      });
}

//Getting descriptions of interesting places to visit
const fs = require('fs')
let descriptions = JSON.parse(fs.readFileSync('./descriptions.json', 'utf-8'))

/* Message on /start command */
bot.on(('/start'), (msg) => {
    msg.reply.text("Ну, типу, привіт 😊. Я ще маленький, але колись я виросту і буду крутим ботом, який розповість тобі все про Острог. Але це не точно 🙃.");
    setTimeout(() =>{

        let replyMarkup = bot.keyboard([
            ['ℹ Де тут ТІЦ?', '📷 Варто побачити'],
            ['🏨 Де зупинитися', '🍽 Де поїсти'],
            ['👀 Що поряд?']
        ], {resize: true});
    
        return bot.sendMessage(msg.from.id, 'А поки розкажи, про що було б цікаво дізнатися.', {replyMarkup});
    }, 1000);
    

});

/* Bot gets text messages and checks them with 'if' for key phrases. To do: rewrite with switch and with Array.prototype.indexOf() */
bot.on('text', (msg) => {

    /*Where to stay*/

    //if checks for the 'Where to stay' message or for the 'go back' command for hotels, if hotel wasn't accesed with what is nearby option
    if(msg.text === "🏨 Де зупинитися" || (msg.text === "👈 назад" && nearbyStatus[msg.from.id].active !== true &&
    (chatStatus[msg.from.id] === "🏨 Готель “АТЛАНТ”" || chatStatus[msg.from.id] === "🏨 Готель “Маестро”" 
    || chatStatus[msg.from.id] === "🏨 Оздоровчий комплекс “Обуховські”"))){
        chatStatus[msg.from.id] = "🏨 Де зупинитися";
        writeChatStatus();

        let promise = new Promise((resolve, reject) => {
            if (msg.text === "🏨 Де зупинитися") {
                let replyMarkup = bot.inlineKeyboard([
                    [
                        bot.inlineButton('Деталі тут', {url: 'http://visitostroh.info/hotels/'})
                    ]
                    ]);
                bot.sendMessage(msg.from.id, 'Гарна новина! В Острозі є готелі. Цілих три 🙃', {replyMarkup});
            }
            resolve();  
        })

        //Showing bot keyboard with all hotels available in the town
        promise.then(() => {
            setTimeout(()=>{
                let replyText;
                let replyMarkup = bot.keyboard([
                    ['🏨 Готель “АТЛАНТ”'],
                    ['🏨 Готель “Маестро”'],
                    ['🏨 Оздоровчий комплекс “Обуховські”'],
                    ['👈 назад']
                ], {resize: true});
                if (msg.text === "🏨 Де зупинитися") {
                    replyText  = "А ще можу детальніше розповісти про окремі готелі 👇."
                } else {
                    replyText  = "Про який готель розповісти детальніше? 👇";
                }
                return bot.sendMessage(msg.from.id, replyText, {replyMarkup});
            }, 500);
            error => {
                // Function call on reject  
                alert("Rejected: " + error); // error - reject argument
              }
        });
        
    } 
    
    else if (msg.text === "🏨 Готель “АТЛАНТ”" || msg.text === "🏨 Готель “Маестро”" || msg.text === "🏨 Оздоровчий комплекс “Обуховські”") {
        if(chatStatus[msg.from.id] === "👀 Що поряд?") {
            nearbyStatus[msg.from.id].active = true;
            writeNearbyStatus();
        } else {
            nearbyStatus[msg.from.id].active = false;
            writeNearbyStatus();
        }

        chatStatus[msg.from.id] = msg.text;
        writeChatStatus();

        //geting description of the place and sending message to user
            let replyMarkup = bot.inlineKeyboard([
                [
                    bot.inlineButton(descriptions[msg.text].more, { url: descriptions[msg.text].url})
                ]
            ]);
        //sending photo of the place to user
        let promise = bot.sendPhoto(msg.from.id, descriptions[msg.text].photo, {caption: descriptions[msg.text].description, replyMarkup});
                
        bot.sendAction(msg.from.id, 'upload_photo');

        //sending bot keyboard with available options
        promise.then(() => {
            setTimeout(()=>{
                let replyMarkup = bot.keyboard([
                    ['💰 Ціни та послуги'],
                    ['📱 Контакти'],
                    ['📍 Отримати координати'],
                    ['👈 назад'],
                ], {resize: true});
                return bot.sendMessage(msg.from.id, "Показати на карті де готель? Розповісти про ціни та послуги? Надати контакти? 👇.", {replyMarkup});
            }, 1000);    
        });
    }

    //showing prices and services available in chosen hotel
    else if (msg.text === "💰 Ціни та послуги") {
        let promise = new Promise((resolve, reject) => {
            let replyMarkup = bot.inlineKeyboard([
                [
                    bot.inlineButton(descriptions[chatStatus[msg.from.id]].pricesText, {url: descriptions[chatStatus[msg.from.id]].pricesUrl})
                ]
                ]);
            bot.sendMessage(msg.from.id, descriptions[chatStatus[msg.from.id]].pricesReply, {replyMarkup});
            resolve();  
        }) 
          
        promise.then(() => {
            setTimeout(()=>{
                return bot.sendMessage(msg.from.id, "Щось іще?");
            }, 500);    
        });
    }
    //showing contacts for chosen hotel
    else if (msg.text === "📱 Контакти") {
        let promise = new Promise((resolve, reject) => {
            bot.sendContact(msg.from.id, descriptions[chatStatus[msg.from.id]].contactsNumber, descriptions[chatStatus[msg.from.id]].contactsName);
            resolve();  
        }) 
          
        promise.then(() => {
            setTimeout(()=>{
                return bot.sendMessage(msg.from.id, "Щось іще?");
            }, 500);    
        });
    }
    /*Nowhere to stay*/

    /*Where to eat */
    // basically it is the same as for hotels
    else if (msg.text === "🍽 Де поїсти" || msg.text === "👈 назад" && 
        (chatStatus[msg.from.id] === "☕ Попити кави" || chatStatus[msg.from.id] === "🥣 Попоїсти")) {
        chatStatus[msg.from.id] = "🍽 Де поїсти";
        writeChatStatus();
                
        let promise = new Promise((resolve, reject) => {
            let replyMarkup = bot.inlineKeyboard([
                [
                    bot.inlineButton('А де поїсти можна знайти тут', {url: 'http://visitostroh.info/where_to_eat/'})
                ]
            ]);
            
            bot.sendMessage(msg.from.id, 'За інформацією ЗМІ, в Острозі туристи не вмирають з голоду, то певно, вони десь їдять 🙃', {replyMarkup});
            resolve();  
        }) 
          
        promise.then(() => {
            setTimeout(()=>{
                let replyMarkup = bot.keyboard([
                    ['☕ Попити кави'],
                    ['🥣 Попоїсти'],
                    ['👈 назад'],
                ], {resize: true});
                return bot.sendMessage(msg.from.id, "Провести час за легкою розмовою з ароматною кавою чи чаєм, чи набратися сил після захопливої екскурсії? 👇.", {replyMarkup});
            }, 500);    
        });
    
    } 
    
    else if (msg.text === "☕ Попити кави" || msg.text === "👈 назад" && nearbyStatus[msg.from.id].active !== true && 
    (chatStatus[msg.from.id] === "☕ Кав’ярня «Академічна»" 
    || chatStatus[msg.from.id] === "☕ Кав’ярня «Американо»" || chatStatus[msg.from.id] === "☕ Кафе «V кав’ярні»"
    || chatStatus[msg.from.id] === "☕ Кав’ярня «Карамель»" || chatStatus[msg.from.id] === "☕ Кафе-бар «Маестро»"
    || chatStatus[msg.from.id] === "☕ Кафе «Why Not?»")) {
        chatStatus[msg.from.id] = "☕ Попити кави";
        writeChatStatus();
        let promise = new Promise((resolve, reject) => {
            if (msg.text === "☕ Попити кави") {
                bot.sendMessage(msg.from.id, 'В місті є кілька закладів де можна затишно посидіти і, наприклад, обговорити з другом чи подругою правильною чи ні була політика Юзефа Пілсудського по відношенню до Західної України');
            }        
            resolve();  
        }) 

        bot.sendAction(msg.from.id, 'upload_photo');

        promise.then(() => {
            setTimeout(()=>{
                let replyMarkup = bot.keyboard([
                    ['☕ Кав’ярня «Академічна»', '☕ Кав’ярня «Американо»'],
                    ['☕ Кафе «V кав’ярні»', '☕ Кав’ярня «Карамель»'],
                    ['☕ Кафе-бар «Маестро»','☕ Кафе «Why Not?»'],
                    ['👈 назад']
                ], {resize: true});
                
                bot.sendMessage(msg.from.id, `Кафе та кав'ярні міста  👇.`, {replyMarkup});
            }, 500);
            error => {
                alert("Rejected: " + error); 
            }
        });

            
    }

    else if (msg.text === "☕ Кав’ярня «Академічна»" 
        || msg.text === "☕ Кав’ярня «Американо»" || msg.text === "☕ Кафе «V кав’ярні»"
        || msg.text === "☕ Кав’ярня «Карамель»" || msg.text === "☕ Кафе-бар «Маестро»"
        || msg.text === "☕ Кафе «Why Not?»" ) {

            if(chatStatus[msg.from.id] === "👀 Що поряд?") {
                nearbyStatus[msg.from.id].active = true;
                writeNearbyStatus();
            } else {
                nearbyStatus[msg.from.id].active = false;
                writeNearbyStatus();
            }

            chatStatus[msg.from.id] = msg.text;
            writeChatStatus();
            
            let promise = new Promise((resolve, reject) => {
                bot.sendPhoto(msg.from.id, descriptions[msg.text].photo, {caption: descriptions[msg.text].description});
 
                resolve();  
            }) 

            bot.sendAction(msg.from.id, 'upload_photo');  
            
            promise.then(() => {
                setTimeout(()=>{
                    let replyMarkup = bot.keyboard([
                        ['⏳ Графік роботи'],
                        ['📍 Отримати координати'],
                        ['👈 назад'],
                    ], {resize: true});
                    
                    bot.sendMessage(msg.from.id, "Підказати, де знайти заклад? Коли він працює? 👇.", {replyMarkup});
                }, 500);
                error => {
                    alert("Rejected: " + error); 
                }
            });
    }

    else if (msg.text === "🥣 Попоїсти" || msg.text === "👈 назад" && nearbyStatus[msg.from.id].active !== true && 
    (chatStatus[msg.from.id] === "🍕 Піцерія «Американо»" 
    || chatStatus[msg.from.id] === "🍲 Кафе «Гриль»" || chatStatus[msg.from.id] === "🍺 Паб «Двір»"
    || chatStatus[msg.from.id] === "🍲 Кафе «Казка»" || chatStatus[msg.from.id] === "🍣 Кафе «Катана»"
    || chatStatus[msg.from.id] === "🍕 Піцерія «Маестро»" || chatStatus[msg.from.id] === "🍲 Ресторан «Рікос»")) {
        chatStatus[msg.from.id] = "☕ Попити кави";
        writeChatStatus();

        let promise = new Promise((resolve, reject) => {
            if (msg.text === "🥣 Попоїсти") {
                bot.sendMessage(msg.from.id, 'В місті є кілька закладів де можна затишно посидіти і, наприклад, обговорити з другом чи подругою правильною чи ні була політика Юзефа Пілсудського по відношенню до Західної України');
            }        
            resolve();  
        }) 
          
        promise.then(() => {
            setTimeout(()=>{
                let replyMarkup = bot.keyboard([
                    ['🍕 Піцерія «Американо»', '🍲 Кафе «Гриль»'],
                    ['🍺 Паб «Двір»', '🍲 Кафе «Казка»'],                  
                    ['🍣 Кафе «Катана»', '🍕 Піцерія «Маестро»'],
                    ['🍲 Ресторан «Рікос»', '👈 назад']
                ], {resize: true});
                
                bot.sendMessage(msg.from.id, `Піцерії, кафе, суші-бари та ресторани міста  👇.`, {replyMarkup});
            }, 1000);
            error => {
                alert("Rejected: " + error); 
            }
        });        
    }

    else if (msg.text === "🍕 Піцерія «Американо»" 
        || msg.text === "🍲 Кафе «Гриль»" || msg.text === "🍺 Паб «Двір»"
        || msg.text === "🍲 Кафе «Казка»" || msg.text === "🍣 Кафе «Катана»"
        || msg.text === "🍕 Піцерія «Маестро»" || msg.text === "🍲 Ресторан «Рікос»" ) {
            
            if(chatStatus[msg.from.id] === "👀 Що поряд?") {
                nearbyStatus[msg.from.id].active = true;
                writeNearbyStatus();
            } else {
                nearbyStatus[msg.from.id].active = false;
                writeNearbyStatus();
            }

            chatStatus[msg.from.id] = msg.text;
            writeChatStatus();

            let promise = new Promise((resolve, reject) => {
                bot.sendPhoto(msg.from.id, descriptions[msg.text].photo, {caption: descriptions[msg.text].description});
 
                resolve();  
            }) 
              
            promise.then(() => {
                let replyMarkup;
                if (msg.text === "🍕 Піцерія «Американо»" || msg.text === "🍣 Кафе «Катана»"
                || msg.text === "🍕 Піцерія «Маестро»" || msg.text === "🍺 Паб «Двір»") {
                    replyMarkup = bot.keyboard([
                        ['⏳ Графік роботи'],
                        ['📱 Контакти'],
                        ['📍 Отримати координати'],
                        ['👈 назад'],
                    ], {resize: true});
                } else {
                    replyMarkup = bot.keyboard([
                        ['⏳ Графік роботи'],
                        ['📍 Отримати координати'],
                        ['👈 назад'],
                    ], {resize: true});
                }
                
                setTimeout(()=>{
                                        
                    bot.sendMessage(msg.from.id, "Підказати, де знайти заклад? Коли він працює? 👇.", {replyMarkup});
                }, 1000);
                error => {
                    alert("Rejected: " + error); 
                }
            });        
    }
    /*Nowhere to eat */

    /*Where is Tourist Center */
    else if (msg.text === "ℹ Де тут ТІЦ?") {
        let promise = new Promise((resolve, reject) => {
            bot.sendPhoto(msg.from.id, "https://scontent.fiev9-1.fna.fbcdn.net/v/t1.0-9/100660215_3214440098567738_2188199100447457280_o.jpg?_nc_cat=109&_nc_sid=e3f864&_nc_ohc=KBaB7uJB65AAX-Zzm04&_nc_ht=scontent.fiev9-1.fna&oh=81b6b71ca1c3758971c7c29fc5e33675&oe=5F4C9D3A", {caption: "ТІЦ відносно нещодавно переїхав. Його точна локація для багатьох вже стала однією з містичних загадок старовинного міста. Але я то знаю де він 😉"});

            resolve();  
        }) 
          
        promise.then(() => {
            setTimeout(()=>{
                return bot.sendLocation(msg.from.id, [50.327890, 26.523801]);            
            }, 1000);
            error => {
                alert("Rejected: " + error); 
            }
        });
    } 
    /*No place for tourists*/

    /*What to see*/
    else if (msg.text === "📷 Варто побачити" || (msg.text === "👈 назад" && 
    (chatStatus[msg.from.id] === "🏰 Музеї" || chatStatus[msg.from.id] === "🏛 Архітектура" 
    || chatStatus[msg.from.id] === "⛪ Сакральна архітектура"))) {
        chatStatus[msg.from.id] = "📷 Варто побачити";

        writeChatStatus();
        let replyMarkup = bot.keyboard([
            ['🏛 Архітектура', '⛪ Сакральна архітектура'],
            ['🏰 Музеї'],['👈 назад']
        ], {resize: true});
    
        return bot.sendMessage(msg.from.id, 'Місто маленьке, але має, що показати. Що конкретно хотілося б побачити?', {replyMarkup});
    } 

    /*See architecture*/
    else if (msg.text === "🏛 Архітектура" || (msg.text === "👈 назад" && 
    (chatStatus[msg.from.id] === "🏛 Архітектура ХІХ-ХХ ст." || chatStatus[msg.from.id] === "🏛 Нова архітектура"
    || chatStatus[msg.from.id] === "🏛 Стара архітектура"))) {
        chatStatus[msg.from.id] = "🏛 Архітектура";
        writeChatStatus();

        let promise = new Promise((resolve, reject) => {
            if (msg.text === "🏛 Архітектура") {
                let replyMarkup = bot.inlineKeyboard([
                    [
                        bot.inlineButton('Все про архітектуру міста тут. Ну ок, не все. Тільки про історичні будівлі.', {url: 'http://visitostroh.info/головна-сторінка/архітектура/'})
                    ]
                    ]);
                
                bot.sendMessage(msg.from.id, 'На старих фото Острог виглядає гарнішим, його тоді ще не зіпсували коробками і пінопластом. Але що я можу знати.', {replyMarkup});
            }        

                resolve();  
        }) 

            promise.then(() => {
                setTimeout(()=>{
                    let replyMarkup = bot.keyboard([
                        ['🏛 Стара архітектура'],
                        ['🏛 Архітектура ХІХ-ХХ ст.'],
                        ['🏛 Нова архітектура'],
                        ['👈 назад']
                    ], {resize: true});
                
                    bot.sendMessage(msg.from.id, 'Розповісти про щось новіше чи про древнє? 👇.', {replyMarkup});
                }, 500);
                error => {
                    alert("Rejected: " + error); 
                }
            });        
    }
    /*Can't see architecture*/

    /* 19th century architectury */
    else if (msg.text === "🏛 Архітектура ХІХ-ХХ ст." || msg.text === "👈 назад" && nearbyStatus[msg.from.id].active !== true &&
    (chatStatus[msg.from.id] === "🏠 Будинок Воблого" 
    || chatStatus[msg.from.id] === "🏠 Будинок Шейнфайна" || chatStatus[msg.from.id] === "🏠 Будинок Вайнтраубе"
    || chatStatus[msg.from.id] === "🏠 Садиба князів Яблоновських" || chatStatus[msg.from.id] === "🏠 Будинок Шейнерберга ХІХ ст"
    || chatStatus[msg.from.id] === "🏠 Школа ім. Станіслава Сташици" || chatStatus[msg.from.id] === "🏠 Острозька гімназія")) {
        chatStatus[msg.from.id] = "🏛 Архітектура ХІХ-ХХ ст.";
        writeChatStatus();

        let promise = new Promise((resolve, reject) => {
            if (msg.text === "🏛 Архітектура ХІХ-ХХ ст.") {
                let replyMarkup = bot.inlineKeyboard([
                    [
                        bot.inlineButton('А більше деталей тут', {url: 'http://visitostroh.info/головна-сторінка/архітектура/'})
                    ]
                    ]);
                
                bot.sendMessage(msg.from.id, 'Історичне обличчя міста дуже постраждало на початку минулого століття, але серед будинків все ще можна зутріти такі, які особисто бачили велику пожежу, Пілсудсього і війни.', {replyMarkup});
            }        

                resolve();  
            }) 
          
            promise.then(() => {
                setTimeout(()=>{
                    let replyMarkup = bot.keyboard([
                        ['🏠 Будинок Воблого', '🏠 Будинок Шейнфайна'],
                        ['🏠 Будинок Вайнтраубе', '🏠 Садиба князів Яблоновських'],
                        ['🏠 Будинок Шейнерберга ХІХ ст', '🏠 Школа ім. Станіслава Сташици'],
                        ['🏠 Острозька гімназія','👈 назад']
                    ], {resize: true});
                
                    bot.sendMessage(msg.from.id, 'Житлові будинки, школи, садиби  👇.', {replyMarkup});
                }, 500);
                error => {
                    alert("Rejected: " + error); 
                  }
            });

            
    }
    
    else if (msg.text === "🏠 Будинок Воблого" 
        || msg.text === "🏠 Будинок Шейнфайна" || msg.text === "🏠 Будинок Вайнтраубе"
        || msg.text === "🏠 Садиба князів Яблоновських" || msg.text === "🏠 Будинок Шейнерберга ХІХ ст"
        || msg.text === "🏠 Школа ім. Станіслава Сташици" || msg.text === "🏠 Острозька гімназія") {
            if(chatStatus[msg.from.id] === "👀 Що поряд?") {
                nearbyStatus[msg.from.id].active = true;
                writeNearbyStatus();
            } else {
                nearbyStatus[msg.from.id].active = false;
                writeNearbyStatus();
            }
            chatStatus[msg.from.id] = msg.text;
            writeChatStatus();

            let promise = bot.sendPhoto(msg.from.id, descriptions[msg.text].photo, {caption: descriptions[msg.text].description});
                


            bot.sendAction(msg.from.id, 'upload_photo');
        
        

        promise.then(() => {
            setTimeout(()=>{
                let replyMarkup = bot.keyboard([
                    ['📍 Отримати координати'],
                    ['👈 назад'],
                ], {resize: true});
                    bot.sendMessage(msg.from.id, "Показати на карті де знайти? 👇.", {replyMarkup});
            }, 500);
        });

            
    }
    /* END 19th century architectury */

    /* modern architectury */
    else if (msg.text === "🏛 Нова архітектура" || msg.text === "👈 назад" && nearbyStatus[msg.from.id].active !== true &&
    (chatStatus[msg.from.id] === "📖 Наукова бібліотека Національного університету “Острозька академія”" 
    || chatStatus[msg.from.id] === "🎓 Новий корпус НаУ “ОА”" )) {
        chatStatus[msg.from.id] = "🏛 Нова архітектура";
        writeChatStatus();

        let promise = new Promise((resolve, reject) => {
            if (msg.text === "🏛 Нова архітектура") {
                let replyMarkup = bot.inlineKeyboard([
                    [
                        bot.inlineButton('А більше деталей тут', {url: 'http://visitostroh.info/головна-сторінка/архітектура/'})
                    ]
                    ]);
                
                bot.sendMessage(msg.from.id, 'Острог маленьке містечко, тому нових архутектурних шедеврів тут мало, та і те що є, то скоріше шедевр в рамках Острога', {replyMarkup});
            }        

                resolve();  
            }) 
          
            promise.then(() => {
                setTimeout(()=>{
                    let replyMarkup = bot.keyboard([
                        ['📖 Наукова бібліотека Національного університету “Острозька академія”'],
                        ['🎓 Новий корпус НаУ “ОА”'],
                        ['👈 назад']
                    ], {resize: true});
                
                    bot.sendMessage(msg.from.id, 'Все, що збудовано не так давно  👇.', {replyMarkup});
                }, 500);
                error => {
                    alert("Rejected: " + error); 
                  }
            });

            
    }

    else if (msg.text === "📖 Наукова бібліотека Національного університету “Острозька академія”" 
        || msg.text === "🎓 Новий корпус НаУ “ОА”") {
            if(chatStatus[msg.from.id] === "👀 Що поряд?") {
                nearbyStatus[msg.from.id].active = true;
                writeNearbyStatus();
            } else {
                nearbyStatus[msg.from.id].active = false;
                writeNearbyStatus();
            }
            chatStatus[msg.from.id] = msg.text;
            writeChatStatus();

            let promise = bot.sendPhoto(msg.from.id, descriptions[msg.text].photo, {caption: descriptions[msg.text].description});
                


            bot.sendAction(msg.from.id, 'upload_photo');
        
        

        promise.then(() => {
            setTimeout(()=>{
                let replyMarkup = bot.keyboard([
                    ['📍 Отримати координати'],
                    ['👈 назад'],
                ], {resize: true});
                    bot.sendMessage(msg.from.id, "Показати на карті де знайти? 👇.", {replyMarkup});
            }, 1000);
        });

            
    }
    /* END modern architectury */

    /* ancient architectury */

    else if (msg.text === "🏛 Стара архітектура" || msg.text === "👈 назад" && nearbyStatus[msg.from.id].active !== true &&
    (chatStatus[msg.from.id] === "🏰 Замок князів Острозьких (Вежа Мурована)" 
    || chatStatus[msg.from.id] === "🛡 Нова (Кругла) вежа" || chatStatus[msg.from.id] === "🛡 Луцька надбрамна вежа XVІ ст."
    || chatStatus[msg.from.id] === "🛡 Татарська надбрамна вежа XVІ ст.")) {
        chatStatus[msg.from.id] = "🏛 Стара архітектура";
        writeChatStatus();

        let promise = new Promise((resolve, reject) => {
            if (msg.text === "🏛 Стара архітектура") {
                let replyMarkup = bot.inlineKeyboard([
                    [
                        bot.inlineButton('А більше деталей тут', {url: 'http://visitostroh.info/головна-сторінка/архітектура/'})
                    ]
                    ]);
                
                bot.sendMessage(msg.from.id, 'Архітектура, яка бачила князів, придворних поетів, купців та розквіт міста.', {replyMarkup});
            }        

                resolve();  
            }) 
          
            promise.then(() => {
                setTimeout(()=>{
                    let replyMarkup = bot.keyboard([
                        ['🏰 Замок князів Острозьких (Вежа Мурована)', '🛡 Нова (Кругла) вежа'],
                        ['🛡 Луцька надбрамна вежа XVІ ст.', '🛡 Татарська надбрамна вежа XVІ ст.'],
                        ['👈 назад']
                    ], {resize: true});
                
                    bot.sendMessage(msg.from.id, 'Все, що збудовано дуже давно  👇.', {replyMarkup});
                }, 500);
                error => {
                    alert("Rejected: " + error); 
                }
            });

            
    }

    else if (msg.text === "🏰 Замок князів Острозьких (Вежа Мурована)" 
        || msg.text === "🛡 Нова (Кругла) вежа" || msg.text === "🛡 Луцька надбрамна вежа XVІ ст."
        || msg.text === "🛡 Татарська надбрамна вежа XVІ ст.") {
            if(chatStatus[msg.from.id] === "👀 Що поряд?") {
                nearbyStatus[msg.from.id].active = true;
                writeNearbyStatus();
            } else {
                nearbyStatus[msg.from.id].active = false;
                writeNearbyStatus();
            }

            chatStatus[msg.from.id] = msg.text;
            writeChatStatus();

        let promise = bot.sendPhoto(msg.from.id, descriptions[msg.text].photo, {caption: descriptions[msg.text].description});
                


            bot.sendAction(msg.from.id, 'upload_photo');
        
        

        promise.then(() => {
            setTimeout(()=>{
                let replyMarkup = bot.keyboard([
                    ['📍 Отримати координати'],
                    ['👈 назад'],
                ], {resize: true});
                    bot.sendMessage(msg.from.id, "Показати на карті де знайти? 👇.", {replyMarkup});
            }, 1000);
        });

            
    }
    /*END ancient architecture */
    /*END architecture*/  
    
    /*Sacred architecture*/
    else if (msg.text === "⛪ Сакральна архітектура" || (msg.text === "👈 назад" && nearbyStatus[msg.from.id].active !== true && 
    (chatStatus[msg.from.id] === "⛪ Студентсько-викладацький храм преподобного Федора Острозького" 
    || chatStatus[msg.from.id] === "⛪ Костел Успіння Діви Марії" || chatStatus[msg.from.id] === "⛪ Богоявленський собор"
    || chatStatus[msg.from.id] === "⛪ Свято-Миколаївська церква" || chatStatus[msg.from.id] === "🕍 Велика Синагога"
    || chatStatus[msg.from.id] === "⛪ Свято Воскресенська церква" || chatStatus[msg.from.id] === "⛪ Троїцький монастир-фортеця в с. Межиріч"))) {
        chatStatus[msg.from.id] = "⛪ Сакральна архітектура";
        writeChatStatus();

        let promise = new Promise((resolve, reject) => {
            if (msg.text === "⛪ Сакральна архітектура") {
                let replyMarkup = bot.inlineKeyboard([
                    [
                        bot.inlineButton('А більше деталей тут', {url: 'http://visitostroh.info/головна-сторінка/сакральна-архітектура/'})
                    ]
                    ]);
                
                bot.sendMessage(msg.from.id, 'Острог настільки старий, що його церкви і синагоги можуть тримати оборону проти гармат ворога. Моргни, якщо б і тобі так, а по факту ти не можеш тримати оборону навіть проти щоденного стресу 😉', {replyMarkup});
            }        

                resolve();  
            }) 
          
            promise.then(() => {
                setTimeout(()=>{
                    let replyMarkup = bot.keyboard([
                        ['⛪ Студентсько-викладацький храм преподобного Федора Острозького', '⛪ Костел Успіння Діви Марії'],
                        ['⛪ Богоявленський собор', '⛪ Свято-Миколаївська церква'],
                        ['🕍 Велика Синагога', '⛪ Свято Воскресенська церква'],
                        ['⛪ Троїцький монастир-фортеця в с. Межиріч','👈 назад']
                    ], {resize: true});
                
                    bot.sendMessage(msg.from.id, 'Храми, церкви та синагога Острога 👇.', {replyMarkup});
                }, 500);
                error => {
                    alert("Rejected: " + error); 
                  }
            });

            
    }

    else if (msg.text === "⛪ Студентсько-викладацький храм преподобного Федора Острозького" 
        || msg.text === "⛪ Костел Успіння Діви Марії" || msg.text === "⛪ Богоявленський собор"
        || msg.text === "⛪ Свято-Миколаївська церква" || msg.text === "🕍 Велика Синагога"
        || msg.text === "⛪ Свято Воскресенська церква" || msg.text === "⛪ Троїцький монастир-фортеця в с. Межиріч") {
            if(chatStatus[msg.from.id] === "👀 Що поряд?") {
                nearbyStatus[msg.from.id].active = true;
                writeNearbyStatus();
            } else {
                nearbyStatus[msg.from.id].active = false;
                writeNearbyStatus();
            }
            
            chatStatus[msg.from.id] = msg.text;
            writeChatStatus();

            let promise = bot.sendPhoto(msg.from.id, descriptions[msg.text].photo, {caption: descriptions[msg.text].description});
                


            bot.sendAction(msg.from.id, 'upload_photo');
        
        

        promise.then(() => {
            setTimeout(()=>{
                let replyMarkup = bot.keyboard([
                    ['📍 Отримати координати'],
                    ['👈 назад'],
                ], {resize: true});
                if(msg.text === "🕍 Велика Синагога") {
                    bot.sendMessage(msg.from.id, "Показати на карті де храм? 👇.", {replyMarkup});
    
                }else {
                    bot.sendMessage(msg.from.id, "Показати на карті де храм? 👇.", {replyMarkup});
                }
            }, 1000);
        });

            
    }
    /*END sacred architecture*/

    /*Museums*/
    else if (msg.text === "🏰 Музеї" || (msg.text === "👈 назад" && nearbyStatus[msg.from.id].active !== true && 
        (chatStatus[msg.from.id] === "🏰 Острозький замок / Краєзнавчий музей" 
        || chatStatus[msg.from.id] === "📖 Луцька вежа / Музей книги" || chatStatus[msg.from.id] === "💶 Нумізматична виставка" 
        || chatStatus[msg.from.id] === "🎓 Музей історії Острозької академії"
    ))) {
        chatStatus[msg.from.id] = "🏰 Музеї";
        writeChatStatus();

        let promise = new Promise((resolve, reject) => {
            if (msg.text === "🏰 Музеї") {
                let replyMarkup = bot.inlineKeyboard([
                    [
                        bot.inlineButton('Про музеї все тут', {url: 'http://visitostroh.info/головна-сторінка/музеї/'})
                    ]
                    ]);
                bot.sendPhoto(msg.from.id, 'https://ostrohcastle.com.ua/wp-content/uploads/2020/07/kit.jpg', {caption: "Є міста, де музеї і більші і новіші. Але де ще вам екскурсію проведе старший мяуковий співробітник?", replyMarkup});
                
            }
                resolve();  
            }) 
          
            promise.then(() => {
                setTimeout(()=>{
                    let replyText;
                    let replyMarkup = bot.keyboard([
                        ['🏰 Острозький замок / Краєзнавчий музей'],
                        ['📖 Луцька вежа / Музей книги'],
                        ['💶 Нумізматична виставка'],
                        ['🎓 Музей історії Острозької академії'],
                        ['👈 назад']
                    ], {resize: true});
                    if (msg.text === "🏰 Музеї") {
                        replyText  = "А ще можу детальніше розповісти про окремі музеї 👇."
                    } else {
                        replyText  = "Про який музей розповісти детальніше? 👇";
                    }
                    return bot.sendMessage(msg.from.id, replyText, {replyMarkup});
                }, 500);
                error => {
                    alert("Rejected: " + error); 
                  }
            });
    } 
    
    else if (msg.text === "🏰 Острозький замок / Краєзнавчий музей" 
    || msg.text === "📖 Луцька вежа / Музей книги" || msg.text === "💶 Нумізматична виставка" 
    || msg.text === "🎓 Музей історії Острозької академії") {
        
        if(chatStatus[msg.from.id] === "👀 Що поряд?") {
            nearbyStatus[msg.from.id].active = true;
            writeNearbyStatus();
        } else {
            nearbyStatus[msg.from.id].active = false;
            writeNearbyStatus();
        }
        chatStatus[msg.from.id] = msg.text;
        writeChatStatus();

        let replyMarkup = bot.inlineKeyboard([
            [
                bot.inlineButton(descriptions[msg.text].more, { url: descriptions[msg.text].url})
            ]
        ]);

        let promise = bot.sendPhoto(msg.from.id, descriptions[msg.text].photo, {caption: descriptions[msg.text].description, replyMarkup});
                


            bot.sendAction(msg.from.id, 'upload_photo');
        
        

        promise.then(() => {
            setTimeout(()=>{
                let replyMarkup = bot.keyboard([
                    ['⏳ Графік роботи'],
                    ['🥽 Віртуальна екскурсія'],
                    ['📍 Отримати координати'],
                    ['👈 назад'],
                ], {resize: true});
                return bot.sendMessage(msg.from.id, "Показати на карті де музей? Розповісти коли він працює? Ще щось? 👇.", {replyMarkup});
            }, 1000);
        });

        
        
    } 

    else if (msg.text === "⏳ Графік роботи") {

        let promise = new Promise((resolve, reject) => {
            bot.sendMessage(msg.from.id, descriptions[chatStatus[msg.from.id]].workingHours);
                resolve();  
            }) 
          
            promise.then(() => {
                setTimeout(()=>{
                    return bot.sendMessage(msg.from.id, "Щось іще?");
                }, 500);
                
            });
    } 

    else if (msg.text === "🥽 Віртуальна екскурсія") {
        let promise = new Promise((resolve, reject) => {
            let replyMarkup = bot.inlineKeyboard([
                [
                    bot.inlineButton(descriptions[chatStatus[msg.from.id]].virtualVisitText, {url: descriptions[chatStatus[msg.from.id]].virtualVisitUrl})
                ]
                ]);
            bot.sendMessage(msg.from.id, descriptions[chatStatus[msg.from.id]].virtualVisitReply, {replyMarkup});
            resolve();  
        }) 
          
        promise.then(() => {
            setTimeout(()=>{
                return bot.sendMessage(msg.from.id, "Щось іще?");
            }, 500);    
        });
    } 

    else if (msg.text === "📍 Отримати координати") {
        let promise = new Promise((resolve, reject) => {
            bot.sendMessage(msg.from.id, descriptions[chatStatus[msg.from.id]].locationDescription);
            bot.sendLocation(msg.from.id, descriptions[chatStatus[msg.from.id]].location);  
            resolve();  
        }) 
          
        promise.then(() => {
            setTimeout(()=>{
                return bot.sendMessage(msg.from.id, "Щось іще?");
            }, 500);    
        });
    }
    /*END museums */

    /*Easter Egg for the sake of Easter Eggs */
    else if (msg.text === "Хто твій татко?") {
        return bot.sendMessage(msg.from.id, "Вова Варишнюк. Але мене не запитували, я не казав 🤫");     
    }

    /*What is nearby*/
    else if (msg.text === "👀 Що поряд?") {
        chatStatus[msg.from.id] = "👀 Що поряд?";
        writeChatStatus();

        let replyMarkup = bot.keyboard([
            [bot.button('location', '📍 Надати боту доступ до моєї локації')],
            ['👈 назад']
        ], {resize: true});
    
        return bot.sendMessage(msg.from.id, 'Це легкий спосіб дізнатися, що з того на що глянути, де поїсти, чи зупинитися є поряд (в радіусі 250 метрів)', {replyMarkup});

    }
    else if (msg.text === "👈 назад" && nearbyStatus[msg.from.id].active === true){
        chatStatus[msg.from.id] = "👀 Що поряд?";
        writeChatStatus();

        nearbyStatus[msg.from.id].active = false;
        writeNearbyStatus();

        let replyMarkup = bot.keyboard(nearbyStatus[msg.from.id].array, {resize: true}); 

        bot.sendMessage(msg.from.id, "Поряд знаходяться: \n" + nearbyStatus[msg.from.id].message, {replyMarkup});
    }

    else if (msg.text === "👈 назад" && (chatStatus[msg.from.id] === "📷 Варто побачити" 
        || chatStatus[msg.from.id] === "ℹ Де тут ТІЦ?" || chatStatus[msg.from.id] === "🏨 Де зупинитися"
        || chatStatus[msg.from.id] === "🍽 Де поїсти" || chatStatus[msg.from.id] === "👀 Що поряд?")) {
        let replyMarkup = bot.keyboard([['ℹ Де тут ТІЦ?', '📷 Варто побачити'],['🏨 Де зупинитися', '🍽 Де поїсти'],['👀 Що поряд?']], {resize: true});
        return bot.sendMessage(msg.from.id, 'Про що було б цікаво дізнатися?', {replyMarkup});
    }

    else {
        if(msg.text !== "/start" && msg.text !== "Хто твій татко?") {
            bot.sendMessage(msg.from.id, "Ти написав_ла: " + msg.text );
        }
    }


    

    
});

/* Handling the location given by user. Formula from StackOverflow */
bot.on(['location'], (msg, self) =>{
    
    nearbyStatus[msg.from.id] = {}
    let lat1 = msg.location.latitude;
    let lon1 = msg.location.longitude;
    let message = "";
    let replyArray = [];
    let counter = 0;
    let row = [];
    for (let description in descriptions) {
        let distance = getDistanceFromLatLon(descriptions[description].location[0], descriptions[description].location[1]);
        if (distance <= 250) {
            message = `${message}\n ${description} - ${distance.toFixed(2)} м.`;
            counter++;
            if(counter % 2 === 0){
                row.push(description);
                replyArray.push(row);
                row =[];
            } else {

                row.push(description);
            }
        }
    }

    function getDistanceFromLatLon (lat2,lon2) {
        var R = 6371000; // Radius of the earth in m
        var dLat = deg2rad(lat2-lat1);  // deg2rad below
        var dLon = deg2rad(lon2-lon1); 
        var a = 
          Math.sin(dLat/2) * Math.sin(dLat/2) +
          Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * 
          Math.sin(dLon/2) * Math.sin(dLon/2)
          ; 
        var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
        var d = R * c; // Distance in m
        return d;
      }
      
      function deg2rad(deg) {
        return deg * (Math.PI/180)
    }

    if(counter === 0) {
        bot.sendMessage(msg.from.id, `Нічого цікавого навколо. Ти точно в Острозі?`);
    } else {
        row.push("👈 назад");
        replyArray.push(row);
        nearbyStatus[msg.from.id].array = replyArray;
        nearbyStatus[msg.from.id].message = message;
        writeNearbyStatus();
        let replyMarkup = bot.keyboard(replyArray, {resize: true}); 

        bot.sendMessage(msg.from.id, "Поряд знаходяться: \n" + message, {replyMarkup});
    }    
    
});


bot.start();