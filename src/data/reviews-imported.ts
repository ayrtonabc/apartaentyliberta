/**
 * Opiniones importadas de Google y Booking.com.
 *
 * Solo se guarda lo que se muestra en la tarjeta: nombre completo, puntuación,
 * comentario y plataforma de origen. Sin fechas, país, tipo de estancia ni
 * cualquier otro metadato.
 *
 * Todos los textos están en polaco, salvo la reseña neerlandesa de Jirg, que se
 * conserva en su idioma original. Las reseñas de Google llegaron en español
 * traducidas por el navegador del propietario y se tradujeron al polaco.
 *
 * `ratingScale` distingue la escala real de cada plataforma: Google puntúa
 * sobre 5 y Booking sobre 10. La tarjeta normaliza ambas a 5 estrellas.
 */

export type ImportedReview = {
  author: string;
  rating: number;
  ratingScale: 5 | 10;
  lang: "pl" | "nl";
  text: string;
  source: "google" | "booking";
};

const g = (author: string, rating: number, text: string): ImportedReview => ({
  author,
  rating,
  ratingScale: 5,
  lang: "pl",
  text,
  source: "google",
});

const b = (
  author: string,
  rating: number,
  text: string,
  lang: "pl" | "nl" = "pl",
): ImportedReview => ({
  author,
  rating,
  ratingScale: 10,
  lang,
  text,
  source: "booking",
});

export const importedReviews: ImportedReview[] = [
  // ────────────────────────────────────────────────────────────── Google (5)
  g("Marta Bielińska", 5, "Gorąco polecamy Apartamenty Liberta! Jest to idealne miejsce na rodzinny wypoczynek lub dla osób poszukujących ciszy, spokoju i natury. …"),
  g("Marta Pszuk", 5, "To świetne miejsce! Byliśmy tu na długi weekend, trzy rodziny z czwórką małych dzieci. 🤩 Pokoje były czyste, wszystko było w porządku…"),
  g("Nikoletta Szumierz", 5, "Fantastyczne miejsce! …"),
  g("Mir Ela", 1, "Cudowne miejsce. Domki są bardzo dobrze wyposażone i utrzymane. Mają widok na jezioro, jest ciepło, mają świetną saunę, lodówkę…"),
  g("Iga W", 5, "Cudowne miejsce! Domki są nieskazitelnie czyste, dobrze wyposażone i przestronne - idealne na rodzinne wakacje. Jest wiele…"),
  g("Ewelina Kreczmer", 5, "Idealne miejsce na wypoczynek! Domek był bardzo wygodny, czysty i dobrze wyposażony. Jacuzzi to fantastyczny detal, który pozwala naprawdę zrelaksować się i…"),
  g("Megi Rzodkiewicz", 5, "Idealne miejsce na weekendowy wypad z przyjaciółmi lub rodziną. Okolica jest bardzo dobrze utrzymana. Domki są czyste i schludne oraz w pełni wyposażone. Właściciele są bardzo przyjaźni. Polecam je! …"),
  g("Damian Arcipowski", 5, "Wynajęliśmy domek na sylwestra na trzy dni i miejsce okazało się strzałem w dziesiątkę. …"),
  g("maciek siemion", 5, "Nasz pobyt w domku Apartamenty Liberta na Mazurach zakończył się pełnym sukcesem. Miejsce jest ciche, dobrze utrzymane i idealne dla…"),
  g("Zuzik Bal", 5, "Nasz pobyt w domku był fantastyczny! Wszystko było bardzo dobrze wyposażone. Właściciele są niezwykle przyjaźni i pomocni, a komunikacja z nimi była szybka i łatwa. Zdecydowanie polecam to miejsce i chętnie wrócę! …"),
  g("Ania Gil", 5, "Nasz pobyt trwał trzy noce, łącznie ze sylwestrem. Miejsce było czyste i dość dobrze wyposażone (brakowało nam tylko ręcznika do wytarcia…"),
  g("Piotr Hołowczyc", 5, "Chociaż lubię narzekać, nie mam na co narzekać. Doskonała obsługa, fantastyczna lokalizacja, dobrze wyposażona kuchnia, klimatyzowane pokoje…"),
  g("Wiktoria Samsel", 5, "Spędziliśmy tutaj Sylwestra i było po prostu fantastycznie! Prywatne jacuzzi było już podgrzewane po naszym przyjeździe i codziennie przygotowywano drewno na opał. Chociaż …"),
  g("Grzegorz Romanowski", 5, "Byliśmy tam w maju grupą sześciu osób. Gorąco polecamy i na pewno wrócimy! Gospodarz był bardzo przyjazny, a okolica była spokojna i cicha. Pozdrowienia! …"),
  g("EO", 5, "Nasz pobyt w apartamencie był fantastyczny! Domek był czysty, wygodny i bardzo dobrze wyposażony; wszystko było zgodne z opisem. Największą zaletą było to,…"),
  g("Lovely CSGO", 5, "Domek jest idealny, jacuzzi jest zawsze gotowe, a otoczenie jest piękne. Na pewno wrócimy! 🥰🥰🥰…"),
  g("Martin Vest", 5, "Wygląda świetnie. …"),
  g("Anna Rudzińska", 5, "Moja rodzina i ja odwiedziliśmy apartament podczas świąt Bożego Narodzenia. Właściciele zadbali o udekorowanie zarówno wnętrza, jak i…"),
  g("Marek Myszka", 5, "Cudowne i zadbane miejsce, idealne zarówno na wypad z przyjaciółmi, jak i rodzinny weekend. Doskonałe udogodnienia (sauna,…"),
  g("Rafal Pietniczka", 5, "Adamie, dziękuję za pobyt. Obsługa i lokalizacja były fantastyczne, zupełnie jak w hotelu 5-gwiazdkowym. Gorąco polecam! …"),
  g("kv nia", 5, "Świetne miejsce na relaks. Domek jest bardzo czysty, przytulny i dobrze wyposażony. Okolica cicha i blisko jeziora. Gorąco polecamy i na pewno wrócimy!"),
  g("Agnieszka Mądra-Pracz", 5, "Cudowne miejsce na wypoczynek, z piękną okolicą i widokiem na jezioro z domku. Domki są w pełni wyposażone. Mają grilla,…"),
  g("Weronika Kurowicka", 5, "Bardzo przyjemny pobyt! Domek jest czysty, przytulny i dobrze wyposażony. Okolica cicha, idealna na wypoczynek. Doskonała komunikacja z właścicielem. Gorąco polecam!"),
  g("Mariusz Bolumiński", 5, "Doskonała lokalizacja, miła i uprzejma obsługa :) Polecam i pozdrawiam właścicieli apartamentu :) …"),
  g("Monika Lembke", 5, "Niedawno miałem przyjemność gościć w Apartamentach Liberta. Fantastyczna lokalizacja nad jeziorem, idealna baza wypadowa na rowerowe przygody. …"),
  g("Marianna 30", 5, "Cudowne miejsce 🥰 jacuzzi, sauna 🤩 cudowni gospodarze 🤗 dom ogrzewany kominkiem. Latem nikt nie będzie się tam nudził 😉 blisko jeziora i placu zabaw. …"),
  g("Natalia Karwalska", 5, "Cudowne miejsce z pięknym widokiem na jezioro. Domki są czyste i dobrze wyposażone. Jest to idealne miejsce na wypoczynek z rodziną lub przyjaciółmi. Byliśmy tam już pięć razy i na pewno wrócimy! Do zobaczenia wkrótce! …"),
  g("Conny", 5, "Idealne miejsce na relaks i oderwanie się od codziennego stresu. Domki są wyposażone we wszystko, czego potrzebujesz: kawę, ręczniki, garnki i patelnie, suszarkę do włosów…"),
  g("Marysia", 5, "Apartament z jacuzzi i sauną to idealne miejsce na relaks i odpoczynek. Przytulny wystrój i wygodne meble sprawią, że pobyt…"),
  g("marvi", 5, "Pobyt w Apartamentach Liberta to prawdziwa przyjemność! Domki są nowoczesne, dobrze wyposażone i bardzo czyste. Dużym atutem jest piękna…"),
  g("Diana Zakrzewska", 5, "Fantastyczny domek w świetnej lokalizacji! Wszystko jest nienaganne, czyste i bardzo wygodne. Właściciele są niesamowicie sympatyczni, pomocni i gościnni; …"),
  g("Ewa Gawin-Zawadzka", 5, "Cudowne miejsce. Od czasu naszej pierwszej wizyty cztery lata temu nie szukaliśmy nigdzie indziej miejsca na wypoczynek nad jeziorem. Nienaganna obsługa, jacuzzi…"),
  g("Piotr Perliński", 5, "Świetne miejsce, polecam o każdej porze roku :)…"),
  g("Sylwia", 5, "Cudowne miejsce, prowadzone przez sympatycznych i pomocnych właścicieli. Domki mają doskonałą lokalizację, są bardzo dobrze wyposażone, oferują piękne widoki…"),
  g("Bartosz Piatkowiak", 5, "Miejsce o wspaniałej lokalizacji, urokliwej atmosferze i doskonałej obsłudze. Gorąco polecam osobom szukającym chwili wytchnienia z dala od zgiełku miasta. …"),
  g("Paulina Kobus-Gadomska", 5, "Piękne domki z jeszcze bardziej spektakularnymi widokami! Kompleks cieszy się doskonałą lokalizacją, zarówno ze względu na łatwy dojazd, jak i bliskość jeziora i…"),
  g("Milena Dąbrowska", 5, "Idealne miejsce na spędzenie czasu z rodziną i przyjaciółmi. Blisko licznych atrakcji i z widokiem na jezioro. Najlepsze jest jacuzzi w każdym domku. Gorąco polecam! …"),
  g("Marcelina Warchoł", 5, "Pobyt był wspaniały, przekroczył wszelkie moje oczekiwania. Polecam bez zastrzeżeń."),
  g("Asia", 5, "Piękne widoki, blisko jeziora, czystej plaży i dwóch pomostów. W pobliżu znajduje się sklep, w którym można wypożyczyć rowery wodne, deski surfingowe i kajaki. …"),
  g("Ewa Fryczke", 5, "Idealne miejsce na odpoczynek i relaks. Domek wyposażony jest we wszystko, czego potrzebujesz. Na powitanie wino i czekoladki 😉. Wspaniały widok na jezioro i jego…"),
  g("Marta Sobkowiak", 5, "Cudowne miejsce prowadzone przez bardzo sympatycznych właścicieli. Domki są nieskazitelne, w doskonałej lokalizacji i bardzo dobrze wyposażone. Znajdują się one w pobliżu…"),
  g("Ewelina Siwiecka", 5, "Domki są bardzo wygodne i w pełni wyposażone, z klimatyzacją we wszystkich pokojach, co jest dużym plusem. Są nienaganne..."),
  g("Kamila Dobrołowicz", 5, "Nowoczesne domki w pięknej okolicy, z widokiem na jezioro i otoczone lasami. Właściciele są bardzo przyjaźni i pomocni. Gorąco je polecam i na pewno wrócimy! …"),
  g("Marek Liberadzki", 5, "Polecam w 100%. Dom spełnił nasze oczekiwania, spędziliśmy fantastyczny weekend, właściciele byli przemili, jacuzzi, sauna, widok na jezioro, dzieci były zadowolone, na pewno wrócimy 🥰…"),
  g("Kuba Żurek", 5, "Fantastyczne miejsce na rodzinny wypoczynek, praktycznie nad jeziorem i bardzo blisko lasu. Byliśmy tam z rodziną trzy razy w…"),
  g("Krzysztof Dmowski", 5, "Standard na najwyższym poziomie, wszystko zgodne z opisem. Świetny kontakt z właścicielem i fantastyczna lokalizacja. Na pewno wrócimy! …"),
  g("Agata Suchecka", 5, "Wspaniałe domki, położone tuż nad brzegiem wody. Ponadto istnieje wiele atrakcji, w tym wypożyczalnia desek do wiosłowania na stojąco, kajaków i rowerów wodnych. …"),
  g("Michał Dąbrowski", 5, "Piękne miejsce, tuż nad brzegiem jeziora. Mieszkaliśmy w dwóch domkach, cztery pary i siedmioro dzieci i ani przez chwilę nie żałowaliśmy. W ciągu dnia…"),
  g("Michał", 5, "Piękne miejsce. Bardzo dobrze wyposażone domki ze spektakularnym widokiem na jezioro. Klimatyzacja, jacuzzi przed domkiem, dostęp do boiska do siatkówki…"),
  g("Calios Fury", 5, "Fantastyczne miejsce, domki na najwyższym poziomie i niesamowicie sympatyczni właściciele. Dzieci były zachwycone tygodniowym pobytem i nie chciały…"),
  g("Ania Sikorska", 5, "Cudowne miejsce, piękna okolica i widok na jezioro z domku. 😍 Domek jest bardzo ładny i bardzo dobrze wyposażony. Na zewnątrz znajduje się solidny…"),
  g("Renata Horna", 1, "Przegląd wypożyczalni sprzętu wodnego. Przez cały dzień korzystaliśmy z udogodnień wypożyczalni. Dwa rowery…"),
  g("Magdalena Majos", 5, "Jutro kończy się nasz tydzień pobytu w tym cudownym miejscu i nie wiem, czy cieszyć się każdą ostatnią chwilą, czy płakać na myśl, że ta idylla dobiega końca. …"),
  g("Karolina Wieczorek", 5, "Właściciele są zawsze gotowi spełnić nawet najbardziej nietypowe życzenia. 😅 Miejsce jest również bardzo czyste, z ręcznikami, piekarnikiem, tosterem,…"),
  g("ALEKSANDRA BEJGER", 5, "Cudowne miejsce. …"),
  g("Marta Bielińska", 5, "Fantastyczne miejsce. Właściciele byli bardzo przyjaźni i pomocni. Domek był wysokiej jakości, a dobrze wyposażona kuchnia była dużym plusem. Kąpiel w jacuzzi pod rozgwieżdżonym niebem będzie niezapomnianym przeżyciem."),
  g("Nats Why", 5, "Nieoczekiwanie przyjemny pobyt. Domek jest praktycznie nowy. Czysto, pięknie wykończona, a pościel pachnie świeżo wypraną! Łazienka…"),
  g("Monika Gron", 5, "Polecam każdemu, kto chce odpocząć z dala od tłumów. Domek jest bardzo czysty i ma codzienną obsługę jacuzzi. Z pokoju roztacza się widok na jezioro. …"),
  g("Tomek S. (TJ)", 2, "Pewnej nocy spałem przed tym apartamentowcem i od południa do późnej nocy, podczas gdy jeden z lokatorów, jego rodzina i jego dzieci..."),
  g("Izabela ZJADEWICZ", 5, "Doskonałe apartamenty z jacuzzi tuż nad jeziorem, niedaleko pięknej plaży. Apartamenty są dobrze wyposażone, czyste i utrzymane przez bardzo …"),
  g("Karolina Kasprzak", 5, "Idealne miejsce na relaks. Domki są przestronne, bardzo czyste i dobrze wyposażone. Właściciel jest niesamowicie przyjazny. 😊 Widok na jezioro jest cudowny, a atmosfera nocą fantastyczna. 😄 Polecam z całego serca. 🥰…"),
  g("Joanna Hejduk", 5, "Kolejne wakacje spędziliśmy z rodziną i przyjaciółmi w Apartamentach Liberta i już chcemy wracać! Fajne domki z klimatyzacją, jacuzzi na świeżym powietrzu…"),
  g("Aneta Surała", 5, "Cudowne miejsce! Domki przepiękne, w środku nieskazitelnie czyste, wszystko zadbane i eleganckie. Właściciele, państwo i pani, zadbali o to, aby…"),
  g("Tomasz Zawadzki", 5, "Coś pięknego! Domki są w pięknym miejscu, wspaniale wyposażone, a co powiedzieć o saunie! Gospodarze są wspaniali, zawsze dostępni…"),
  g("Milena Łukaszewska", 5, "Polecam bez zastrzeżeń. Miejsce z autentycznym urokiem. Idealny do oderwania się od rutyny. Piękne widoki, bezkonkurencyjna lokalizacja. Sauna, jacuzzi… …"),
  g("Jacek Drąg", 5, "Polecam każdemu Apartamenty Liberta. …"),
  g("Martyna Gwizdała", 5, "Piękne miejsce, ze wspaniałą atmosferą w domkach, saunie i jacuzzi. Idealne miejsce na prawdziwy relaks. …"),
  g("Justa Kwiat", 5, "Cudowne miejsce. Domki położone są na wzgórzu z widokiem na jezioro. Spektakularne widoki. Czysto i wygodnie, z bardzo sympatycznymi właścicielami. Idealne miejsce dla rodzin z dziećmi."),
  g("ALDEK WOJDA", 1, "Ta recenzja dotyczy wynajmu sprzętu do sportów wodnych. Usługa jest do zaakceptowania. Właściciel nie jest godny zaufania. Dzieci skupiają się na pływaniu. …"),
  g("kacper Michalak", 5, "Gorąco polecam. Fantastyczne miejsce na świecie, z bardzo sympatycznymi gospodarzami. Wspaniałe domki, w których można odpocząć i dobrze się bawić. Wspaniała atmosfera, wspaniali ludzie, mnóstwo dobrej zabawy. Dziękuję bardzo za miły pobyt ❤️😈"),
  g("olamoskal134", 5, "Urocze miejsce, idealne na wypoczynek. Blisko do jeziora i innych atrakcji. Właściciele są bardzo przyjaźni i uprzejmi. Ich profesjonalizm sprawia, że ​​goście mogą skupić się wyłącznie na odpoczynku. …"),
  g("Emilka Lutyńska", 5, "Dawno nie odwiedziłam tak uroczego miejsca! Lokalizacja i atrakcje są idealne na wypad z przyjaciółmi. Spędziliśmy go od…"),
  g("Anna D.", 5, "Bardzo mili właściciele, cudowna lokalizacja, plac zabaw, wypożyczalnia sprzętu wodnego i oczywiście piękna chata. Przyjdź do…"),
  g("Paula", 5, "Cudowne miejsce, stworzone przez cudownych ludzi! Zawsze chętnie wracamy. …"),
  g("An. W.", 5, "Cudowne miejsce na relaks! Nigdy nie odpoczywaliśmy tak bardzo jak tutaj. To było magiczne przeżycie. Już nie możemy się doczekać naszych…"),
  g("Żaklina", 5, "Idealne miejsce na wypoczynek z przyjaciółmi, rodziną i dziećmi. Właściciele są bardzo sympatyczni i dbają o komfort swoich gości. …"),
  g("Mateusz Badowski", 5, "Miejsce jak z bajki, miejsce cudowne. Dziękujemy Piotrowi i jego żonie za cały wysiłek włożony w to, aby pobyt naszej grupy był nie do pobicia. :) Do zobaczenia za rok!"),
  g("Marta Markowska", 5, "Idealne miejsce na relaks. Apartamenty odpowiadają w 100% opisowi i zdjęciom na stronie. Prezent powitalny uzupełnia luksusowy pobyt. …"),
  g("Michał", 5, "Całkowicie to polecam. Właściciele są świetni i tworzą najlepszą atmosferę na świecie. Jeśli szukasz miejsca na relaks i zabawę, nie szukaj dalej niż Apartamenty Liberta!"),
  g("Rafał", 5, "Świetne miejsce, przemili właściciele, wysokiej jakości domki, wygodne i idealne na wypoczynek na Mazurach, blisko plaży i restauracji. Szczególnie polecam ogrzewaną łazienkę."),
  g("Lilka", 5, "Świetne miejsce! …"),
  g("Dariusz Dziubek", 5, "Świetne miejsce, ze wspaniałymi nowoczesnymi domkami, każda z własnym jacuzzi. Gospodarz jest bardzo przyjazny i zawsze gotowy do pomocy. Nie ma żadnych wad. Gorąco polecam."),
  g("Daniel Bolotow", 5, "Polecam bez wątpienia. Domek jest czysty i bardzo dobrze wyposażony. Dobra lokalizacja. Doskonała alternatywa dla plaży."),
  g("Karolina Skorupska", 5, "Piękne miejsce na wypoczynek, zabawę i trening. Przestronne i w pełni wyposażone domy, z muzyką jazzową na świeżym powietrzu i grillem w pomieszczeniu, które tworzą wspaniałą atmosferę."),
  g("Rafal Jarząbek", 5, "Fantastyczna lokalizacja z niesamowitymi widokami, blisko restauracji i szerokiej oferty sportów wodnych. Gorąco polecam."),
  g("lucas toma", 5, "Świetne miejsce, z wygodnymi domkami i sauną, która pozwala na relaks nawet gdy pogoda nie dopisuje."),
  g("Przemysław Melka", 5, "Bardzo wygodne domki w doskonałej lokalizacji, idealne na każdy rodzaj wypoczynku na Mazurach. …"),
  g("Patrycja Żebrowska", 5, "Miejsce godne polecenia! Piękne, czyste i ciche. Właściciele są bardzo przyjaźni i gościnni. Kto wie? Może jeszcze się spotkamy! :)"),
  g("Tbodzios Guma", 5, "Wszystko było idealne. Gospodarz bardzo dba o swoich gości. Widok jest fantastyczny. Wszystko da się zorganizować i negocjować. Po-le-cam. …"),
  g("Dariusz Lewandowski", 5, "To miejsce jest piękne. Domki są czyste i dobrze utrzymane. Gospodarze byli wspaniali. To było po prostu fantastyczne. Polecam to."),
  g("Jakub Faleńczyk", 5, "Cudowne miejsce, cudowna atmosfera, cudowni właściciele. Polecam to miejsce na ucieczkę od zgiełku dnia codziennego."),
  g("Ludwika Wisniewska", 5, "Cudowne miejsce, polecam każdemu 🥰…"),
  g("Sylwia Łukaszewska", 5, "Magiczne i przytulne miejsce, stworzone z pasją i miłością przez wspaniałych ludzi. Można się tam zgubić. …"),
  g("Andrzej Sikorski", 5, "Gorąco polecam to miejsce! Doskonała lokalizacja. Właściciele są niesamowicie sympatyczni. Domki są nienagannie wykończone, z dbałością o każdy szczegół. Na pewno wrócimy!"),
  g("Tomek Mączka", 5, "Idealne miejsce na wypoczynek, z doskonałą infrastrukturą i bardzo sympatycznymi gospodarzami. Gorąco polecam."),
  g("Marek Janiszewski", 5, "Świetne miejsce, warte każdej wydanej złotówki, polecam, przepiękna atmosfera, idealne na relaksujący wypoczynek. …"),
  g("Paweł Sosnowski", 5, "Świetne miejsce. Bardzo wysoka jakość, czysto i schludnie. Właściciele są bardzo przyjaźni. Polecam to."),
  g("Dj Joker", 5, "Niesamowity! ❤️❤️❤️❤️❤️ Będziemy wracać i to nie raz. Idealne miejsce nie tylko na rodzinne wakacje 🔥🔥🔥🔥🔥…"),
  g("Zeus Zeus", 5, "Magiczne miejsce. Właściciele są wspaniali! Jeśli jeszcze nie byłeś, nie żałuj, odwiedź to miejsce! Polecam każdemu 👍"),
  g("Natalia Kolasińska", 5, "Polecam to miejsce, niesamowite widoki, super apartament, rewelacyjne warunki, jednym słowem super!"),
  g("Dominika Paprocka", 5, "Świetnie się bawiliśmy. W domku jest wszystko, czego potrzebujesz. Właściciele są bardzo przyjaźni. Jacuzzi jest najlepsze ze wszystkich: jest fantastyczne!"),
  g("Adam Sojak", 5, "Bardzo sympatyczni i pomocni gospodarze; Domki są bardzo dobrze wyposażone we wszystko co potrzebne. …"),
  g("Piotr TUTKA", 5, "5 za atmosferę, 5 za obsługę, 5 za jakość i 10 za gościnność. Polecam to!"),

  // ─────────────────────────────────────────────────────────── Booking (10)
  b("Krzysztof", 10, "Świetne miejsce! Polecamy w 200%. Gospodarze bardzo mili, przygotowanie codziennie drewna, oczyszczanie Balii na duży plus. Sauna - świetna sprawa! Łóżka wygodne, czysto w domku. Naprawdę super miejsce na wypoczynek! Idealne miejsce z pięknym widokiem na jezioro, super okolica by pospacerować i pojeździć na rowerze. Można skorzystać z rowerku wodnego i popływać po jeziorze. Zapewne tam wrócimy! 😍", "pl"),
  b("Dominika", 10, "Wszystko co potrzebne było na miejscu, gospodarz dbający o gości w najdrobniejszym szczególe, kameralne otoczenie, jacuzzi zawsze rano gotowe do użycia, czyściutko i luksusowo :)", "pl"),
  b("Monika", 10, "Super wyposażony domek, mili i pomocni właściciele. Możliwość korzystania z jacuzzi i sprzętu wodnego. Bliski dostęp do jeziora. Cicha i spokojna okolica. Polecamy.", "pl"),
  b("Arkadiusz", 10, "Jacuzzi, wyposażenie domku, czystość, odległość od jeziora. Nie ma takiej rzeczy.", "pl"),
  b("Nikoletta", 10, "Duży, czysty i w pełni wyposażony domek z jacuzzi. Rewelacyjne atrakcje dla dzieci (plac zabaw, rowerki, zjeżdżalnia wodna) oraz przemiła, uśmiechnięta i bardzo pomocna obsługa. Wszystko było super, brak jakichkolwiek zastrzeżeń.", "pl"),
  b("Jacek", 9, "Miła atmosfera i właściciele. Komfort i lokalizacja. Jakuzzi, sauna i taras z kompletem wypoczynkowym.", "pl"),
  b("Holowczyc", 10, "Świetna lokalizacja, super wyposażenie domku, sauna i jacuzzi.", "pl"),
  b("Piotr", 10, "Genialna lokalizacja, świetne udogodnienia dla małych dzieci (plac zabaw na miejscu, plaża, balia z jacuzzi, w domku nawet jakieś zabawki, gry planszowe i zestaw do gry w badmintona). Rowery dostępne na miejscu (w cenie pobytu) to również świetny dodatek — zwłaszcza że jest gdzie jeździć :) Same domki wyposażone we wszystko co potrzebne, bardzo ładne i zadbane. Czystość na wysokim poziomie. Świetne materace na łóżkach, bardzo dobrze się spało. Trochę zimna podłoga w salonie, przydałby się jakiś dywanik :)", "pl"),
  b("Karolina", 10, "Super wyposażony domek, czysto i wygodnie :) Piękny widok na jezioro! Świetne wyposażenie i piękna okolica.", "pl"),
  b("Artur", 10, "Właściciele, drewno zawsze przygotowane z rana, tak samo jacuzzi.", "pl"),
  b("Jirg", 9, "Propere woning met mooie buitenruimte. De aangeboden faciliteiten (jacuzzi, fietsen, pedalo, strandje, beachvolleyveld, ...) waren absolute meerwaarde. Leuk dat de kachel van de jacuzzi elke dag schoon en startklaar werd gemaakt. De omgeving is optimaal voor fietstochten en wandelingen. We hebben heel erg van ons verblijf genoten! Het dekbed van het tweepersoonsbed was te smal voor 2 personen.", "nl"),
  b("Joanna", 10, "Wyjątkowy", "pl"),
  b("Tomasz", 10, "Wyjątkowy", "pl"),
  b("Emil", 10, "Wyjątkowy", "pl"),
  b("Paulina", 10, "Piękne widoki, idealne miejsce na spacery, miła obsługa, znakomite wyposażenie domków.", "pl"),
  b("Marta", 10, "Wyjątkowy", "pl"),
  b("Marcin", 10, "Wyjątkowy", "pl"),
  b("Dominika", 9, "Fantastyczny", "pl"),
];

// 103 reseñas de Google + 18 de Booking = 121
