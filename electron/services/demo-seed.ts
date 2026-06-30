import type { DbInstance } from './db'

interface DemoMsg {
  text: string
  ctx: string
  day: number
  h: number
  m: number
}

const BASE = new Date(2026, 4, 30).getTime()

const MSGS: DemoMsg[] = [
  // ── Day 0 · May 30 (Sat) ──────────────────────────────────────────
  { text: 'comprar leche huevos manteca pan lactal', ctx: 'Lista de compras para el fin de semana #compra', day: 0, h: 10, m: 15 },
  { text: 'cumple tomi 8/6 conseguir regalo', ctx: 'Recordatorio de cumpleaños de Tomi el 8 de junio, hay que comprar regalo #recordatorio #evento', day: 0, h: 11, m: 42 },
  { text: 'idea app q mide ruido en oficinas abiertas con el microfono y un dashboard', ctx: 'Idea de producto para una app que mide ruido en oficinas #idea #trabajo', day: 0, h: 15, m: 30 },

  // ── Day 1 · May 31 (Sun) ──────────────────────────────────────────
  { text: 'receta flan 6 huevos 1 leche condensada escencia vainilla caramelo', ctx: 'Receta de flan casero con ingredientes detallados #receta', day: 1, h: 9, m: 20 },
  { text: 'dr gomez 1155550192 dentista', ctx: 'Número de teléfono del dentista Dr. Gómez #contacto', day: 1, h: 12, m: 5 },
  { text: 'pensar slide de braintwo para el jueves mostrar timeline filtros y busqueda', ctx: 'Idea para la presentación de BrainTwo del jueves, mostrar timeline con filtros y búsqueda #idea #trabajo', day: 1, h: 18, m: 45 },

  // ── Day 2 · June 1 (Mon) ──────────────────────────────────────────
  { text: 'turno dentista 15/6 10 30 av santa fe 3200', ctx: 'Turno con el dentista el 15 de junio a las 10:30 en Av. Santa Fe 3200 #recordatorio #evento', day: 2, h: 8, m: 10 },
  { text: 'entrega tp sistemas operativos 22/6 grupo martina y lucas', ctx: 'Entrega de trabajo práctico de Sistemas Operativos el 22 de junio #recordatorio #estudio', day: 2, h: 11, m: 30 },
  { text: 'cbu 0140235803762049531433 alias juan perez mp', ctx: 'CBU y alias bancario de Juan Pérez #info #contacto', day: 2, h: 14, m: 0 },
  { text: 'https youtu be abc123 intro a machine learning python', ctx: 'Video guardado sobre introducción a machine learning #link #estudio', day: 2, h: 22, m: 15 },

  // ── Day 3 · June 2 (Tue) ──────────────────────────────────────────
  { text: 'facturar clinica del salvador 85000 cuit 30715249865 cobro 10/6', ctx: 'Facturación pendiente a Clínica Del Salvador por $85.000, cobro el 10 de junio #recordatorio #trabajo #gasto', day: 3, h: 9, m: 0 },
  { text: 'super arroz fideos salsa tomate queso cremoso cafe', ctx: 'Lista de compras del supermercado #compra', day: 3, h: 12, m: 45 },
  { text: 'av corrientes 1849 3 c CABA escalera no ascensor', ctx: 'Dirección de entrega o visita: Av. Corrientes 1849 3°C #contacto #info', day: 3, h: 16, m: 20 },
  { text: 'idea canal youtube tips organizacion con whatsapp', ctx: 'Idea para un canal de YouTube sobre organización personal con WhatsApp #idea', day: 3, h: 21, m: 30 },

  // ── Day 4 · June 3 (Wed) ──────────────────────────────────────────
  { text: 'sacar turno oftalmologo hace 2 años no me reviso', ctx: 'Pendiente: sacar turno con el oftalmólogo para revisión #recordatorio #salud', day: 4, h: 10, m: 0 },
  { text: 'tp base de datos entrega 18/6 optimizacion consultas indices compuestos', ctx: 'Trabajo práctico de Base de Datos, entrega 18 de junio, tema optimización de consultas #recordatorio #estudio', day: 4, h: 15, m: 10 },
  { text: 'jueves 13hs sync frontend link meet calendario', ctx: 'Reunión semanal con el equipo frontend los jueves a las 13hs #trabajo #evento', day: 4, h: 19, m: 0 },

  // ── Day 5 · June 4 (Thu) ──────────────────────────────────────────
  { text: 'presentacion braintwo hoy  1 busqueda semantica 2 privacidad 3 demo con ejemplos reales', ctx: 'Preparación para la presentación de BrainTwo del jueves con puntos clave a cubrir #trabajo #evento', day: 5, h: 7, m: 45 },
  { text: 'frase  la simplicidad es la maxima sofisticacion leonardo da vinci', ctx: 'Cita de Leonardo da Vinci sobre la simplicidad #info', day: 5, h: 9, m: 30 },
  { text: 'cuit 20301234567', ctx: 'Número de CUIT propio anotado para referencia #info', day: 5, h: 13, m: 15 },
  { text: 'presupuesto reparacion 45000 cambiar pantalla notebook', ctx: 'Presupuesto de reparación de notebook por $45.000 #gasto', day: 5, h: 17, m: 40 },
  { text: 'llamar a mama confirmar finde', ctx: 'Llamar a mamá para confirmar el fin de semana #recordatorio', day: 5, h: 20, m: 0 },

  // ── Day 6 · June 5 (Fri) ──────────────────────────────────────────
  { text: 'facturar estudio juridico martinez 120000 cobro 15/6', ctx: 'Facturación pendiente a Estudio Jurídico Martínez por $120.000, cobro el 15 de junio #trabajo #gasto', day: 6, h: 8, m: 20 },
  { text: 'mejores practicas react 19 https react dev blog', ctx: 'Link a artículo sobre mejores prácticas de React 19 #link #estudio', day: 6, h: 11, m: 50 },
  { text: 'comprar zapatillas nuevas las actuales se rompieron', ctx: 'Recordatorio de comprar zapatillas nuevas #compra', day: 6, h: 18, m: 10 },

  // ── Day 7 · June 6 (Sat) ──────────────────────────────────────────
  { text: 'argentina grupo h debut 15/6 vs francia', ctx: 'Fixture del mundial, Argentina en grupo H, debut 15 de junio contra Francia #evento #mundial', day: 7, h: 10, m: 0 },
  { text: 'asado finde comprar vacio choris morcilla pan chimichurri coca', ctx: 'Lista de compras para el asado del domingo #compra #receta', day: 7, h: 11, m: 25 },
  { text: 'idea nombre proyecto recall corto facil dice lo q hace', ctx: 'Posible nombre para un proyecto personal #idea', day: 7, h: 16, m: 0 },
  { text: 'sorteo ypf mundial 20/6 19hs en lo de fer', ctx: 'Recordatorio para ver el sorteo YPF del Mundial el 20 de junio #recordatorio #mundial', day: 7, h: 20, m: 30 },

  // ── Day 8 · June 7 (Sun) ──────────────────────────────────────────
  { text: 'mañana cumple tomi 8/6 comprar regalo si o si', ctx: 'Cumpleaños de Tomi el 8 de junio, recordatorio de comprar el regalo #recordatorio #evento', day: 8, h: 9, m: 10 },
  { text: 'vinoteca electrica musimundo 89000 para tomi', ctx: 'Idea de regalo para el cumpleaños de Tomi: una vinoteca eléctrica #idea #compra #evento', day: 8, h: 12, m: 0 },
  { text: 'dsp comprar play 6 sale 23', ctx: 'Anotación rápida sobre comprar una PlayStation 6, hay que comprar esta semana #compra', day: 8, h: 15, m: 50 },

  // ── Day 9 · June 8 (Mon) ──────────────────────────────────────────
  { text: 'feliz cumple tomi  pasar a la noche x la vinoteca', ctx: 'Saludo de cumpleaños para Tomi y recordatorio de pasar a buscar el regalo #evento #recordatorio', day: 9, h: 8, m: 30 },
  { text: 'revisar pr de auth antes del deploy miercoles', ctx: 'Revisar pull request de autenticación antes del deploy del miércoles #trabajo #recordatorio', day: 9, h: 11, m: 0 },
  { text: 'pagar luz vence 8/6 ver monto factura digital', ctx: 'Vencimiento de la factura de luz el 8 de junio #recordatorio #gasto', day: 9, h: 14, m: 20 },
  { text: 'nro socio 48392 sportclub', ctx: 'Número de socio del gimnasio SportClub #info', day: 9, h: 18, m: 45 },

  // ── Day 10 · June 9 (Tue) ─────────────────────────────────────────
  { text: '3 principios apis rest 1 recursos nombres 2 metodos http 3 versionado uri', ctx: 'Apuntes sobre principios de diseño de APIs REST #estudio', day: 10, h: 10, m: 0 },
  { text: 'vuelos bariloche 180000 ida y vuelta junio', ctx: 'Link a oferta de vuelos a Bariloche por $180.000 #link #gasto', day: 10, h: 13, m: 15 },
  { text: 'transferir 8500 a admin x el portero electrico', ctx: 'Transferencia pendiente a la administración por arreglo del portero eléctrico #gasto #recordatorio', day: 10, h: 16, m: 30 },
  { text: 'router 192 168 0 1 admin admin123 no compartir', ctx: 'Datos de acceso al router local #info', day: 10, h: 21, m: 0 },

  // ── Day 11 · June 10 (Wed) ────────────────────────────────────────
  { text: 'entradas el cancer colon 27/6 20hs platea baja fila 5', ctx: 'Entradas para la obra El Cáncer en el Teatro Colón el 27 de junio a las 20hs #evento #recordatorio', day: 11, h: 9, m: 15 },
  { text: 'matias 1140328765 electricista recomienda pedro', ctx: 'Número de teléfono del electricista Matías #contacto', day: 11, h: 12, m: 30 },
  { text: 'pagar expensas antes 10/6 32000 este mes', ctx: 'Vencimiento de expensas el 10 de junio por $32.000 #gasto #recordatorio', day: 11, h: 15, m: 0 },
  { text: 'podcast lex fridman episodio creador docker', ctx: 'Recomendación de podcast de Lex Fridman sobre Docker #link #info', day: 11, h: 20, m: 10 },

  // ── Day 12 · June 11 (Thu) ────────────────────────────────────────
  { text: 'preparar demo cliente viernes  buscar timeline y chat', ctx: 'Preparar demo para el cliente, mostrar buscador, timeline y AI chat #trabajo #recordatorio', day: 12, h: 8, m: 45 },
  { text: 'teorema bayes  p a b  p b a p a P b', ctx: 'Fórmula del teorema de Bayes para probabilidad condicional #estudio', day: 12, h: 11, m: 0 },
  { text: 'cambiar prode oficina argentina francia 2 1', ctx: 'Actualizar el pronóstico del prode de la oficina para Argentina vs Francia #mundial #trabajo', day: 12, h: 14, m: 30 },
  { text: 'dolar blue 1350 esperar q baje', ctx: 'Cotización del dólar blue a $1350, esperar para comprar #gasto #info', day: 12, h: 17, m: 0 },

  // ── Day 13 · June 12 (Fri) ────────────────────────────────────────
  { text: 'reunion tutor 12/6 16hs llevar avance tp final', ctx: 'Reunión con el tutor el 12 de junio a las 16hs para revisar avance del TP #evento #estudio', day: 13, h: 9, m: 0 },
  { text: 'git rebase i head n squash commits  git stash save msg', ctx: 'Comandos útiles de git para rebase interactivo y stash #estudio', day: 13, h: 12, m: 15 },
  { text: 'idea feature braintwo resumen semanal automatico de temas', ctx: 'Idea de feature para BrainTwo: resumen semanal automático de temas #idea #trabajo', day: 13, h: 16, m: 40 },
  { text: 'pagar monotributo vence 20/6 cat b 15000', ctx: 'Vencimiento del monotributo categoría B el 20 de junio #recordatorio #gasto', day: 13, h: 19, m: 30 },

  // ── Day 14 · June 13 (Sat) ────────────────────────────────────────
  { text: 'como hacer backup whatsapp https wa me backup', ctx: 'Tutorial guardado sobre cómo hacer backup de WhatsApp #link #info', day: 14, h: 10, m: 0 },
  { text: 'vtv vence 10/7 sacar turno esta semana', ctx: 'Recordatorio de vencimiento de la VTV el 10 de julio #recordatorio', day: 14, h: 14, m: 30 },
  { text: 'idea saas turnos talleres mecanicos mercado grande nada bueno ahi', ctx: 'Idea de SaaS para gestión de turnos en talleres mecánicos #idea', day: 14, h: 18, m: 0 },
  { text: 'juntada santi sabado q viene llevar algo xa tomar', ctx: 'Juntada en casa de Santi el próximo sábado, llevar bebida #evento', day: 14, h: 21, m: 15 },

  // ── Day 15 · June 14 (Sun) ────────────────────────────────────────
  { text: 'armamos prode con los del laburo 500 c u gana uno solo', ctx: 'Prode del mundial armado con los compañeros de trabajo, $500 cada uno #mundial #trabajo', day: 15, h: 11, m: 0 },
  { text: 'idea juego trivia xa la juntada sabado', ctx: 'Idea de juego de trivia para la juntada del sábado #idea #evento', day: 15, h: 16, m: 20 },
  { text: 'sacar turno dni nuevo vence agosto', ctx: 'Sacar turno para renovar el DNI electrónico #recordatorio', day: 15, h: 19, m: 0 },

  // ── Day 16 · June 15 (Mon) ────────────────────────────────────────
  { text: 'hoy argentina francia debut mundial 16hs en casa pedro', ctx: 'Debut de Argentina en el mundial contra Francia, ver en casa de Pedro #mundial #evento', day: 16, h: 8, m: 30 },
  { text: 'dentista 10 30 no olvidar', ctx: 'Turno con el dentista a las 10:30 #recordatorio #evento', day: 16, h: 8, m: 35 },
  { text: 'cobrar factura martinez 120000 hoy', ctx: 'Cobrar factura al Estudio Jurídico Martínez por $120.000 #trabajo #recordatorio', day: 16, h: 11, m: 0 },
  { text: 'clase paradigmas programacion funcional vs objetos ventajas inmutabilidad', ctx: 'Apuntes de la clase de Paradigmas sobre programación funcional #estudio', day: 16, h: 17, m: 45 },
  { text: 'sprint review miercoles 10hs preparar q mostrar', ctx: 'Sprint review el miércoles a las 10hs, preparar lo que se va a mostrar #trabajo #evento', day: 16, h: 20, m: 30 },

  // ── Day 17 · June 16 (Tue) ────────────────────────────────────────
  { text: 'canal youtube cocina japonesa recomendo martina https youtube com c japoneseats', ctx: 'Canal de YouTube de cocina japonesa recomendado por Martina #link', day: 17, h: 9, m: 10 },
  { text: 'auto al lavadero lleno de tierra del finde', ctx: 'Llevar el auto al lavadero #recordatorio', day: 17, h: 12, m: 0 },
  { text: 'clean architecture capas con dependencias hacia adentro el dominio no sabe de infraestructura', ctx: 'Apunte sobre clean architecture y separación en capas #estudio', day: 17, h: 15, m: 30 },
  { text: 'tips dormir mejor nada de pantallas 1 hora antes leer ficcion', ctx: 'Tips para mejorar la calidad del sueño #info', day: 17, h: 22, m: 0 },

  // ── Day 18 · June 17 (Wed) ────────────────────────────────────────
  { text: 'entrega tp base de datos mañana  subir a classroom antes 23 59', ctx: 'Entrega del TP de Base de Datos mañana antes de las 23:59 #recordatorio #estudio', day: 18, h: 9, m: 0 },
  { text: 'reunion hr 24/6 14hs feedback periodo prueba', ctx: 'Reunión de feedback con HR el 24 de junio a las 14hs #trabajo #evento', day: 18, h: 14, m: 30 },
  { text: 'jazz pa programar https open spotify com playlist xyz', ctx: 'Playlist de jazz para programar guardada #link', day: 18, h: 16, m: 0 },
  { text: 'idea regalo cumple amigo libro fotos bs as', ctx: 'Idea de regalo de cumpleaños: libro de fotografías de Buenos Aires #idea', day: 18, h: 20, m: 10 },

  // ── Day 19 · June 18 (Thu) ────────────────────────────────────────
  { text: 'tp bd entregado  ahora el de sistemas operativos', ctx: 'TP de Base de Datos entregado, ahora enfocarse en Sistemas Operativos #estudio #recordatorio', day: 19, h: 10, m: 0 },
  { text: 'objetivos q3 definir kpis productividad bugs cerrados tiempo respuesta', ctx: 'Definir KPIs para objetivos del Q3 con el equipo #trabajo', day: 19, h: 14, m: 15 },
  { text: 'rendir b2 ingles agosto practicar speaking', ctx: 'Preparación para rendir certificado de inglés B2 en agosto #recordatorio #estudio', day: 19, h: 18, m: 30 },

  // ── Day 20 · June 19 (Fri) ────────────────────────────────────────
  { text: 'hoy sorteo ypf mundial 19hs no llegar tarde a lo de fer', ctx: 'Sorteo YPF del Mundial hoy a las 19hs en casa de Fer #mundial #evento', day: 20, h: 8, m: 0 },
  { text: 'monotributo vence mañana 14978 50', ctx: 'Vencimiento del monotributo mañana por $14.978,50 #gasto #recordatorio', day: 20, h: 11, m: 20 },
  { text: 'transferencia pedro 2500 almuerzo semana pasada', ctx: 'Transferencia a Pedro por $2500 de un almuerzo #gasto', day: 20, h: 14, m: 45 },
  { text: 'cp 1425 recoleta', ctx: 'Código postal de Recoleta #info', day: 20, h: 18, m: 0 },
  { text: 'sqlite vec docs https alexandra zaharia github io sqlite vec', ctx: 'Link a la documentación de sqlite-vec para referencia #link #estudio', day: 20, h: 22, m: 0 },

  // ── Day 21 · June 20 (Sat) ────────────────────────────────────────
  { text: 'monotributo pagado', ctx: 'Monotributo pagado, está al día #gasto', day: 21, h: 10, m: 0 },
  { text: 'estamos en 16avos   ', ctx: 'Argentina está en 16avos de final del mundial #mundial', day: 21, h: 15, m: 0 },
  { text: 'cuanto mas grande parece la tarea mas procrastino  dividir en pasos chicos', ctx: 'Reflexión sobre procrastinación y cómo dividir tareas grandes en pasos chicos #info', day: 21, h: 19, m: 45 },

  // ── Day 22 · June 21 (Sun) ────────────────────────────────────────
  { text: 'tp sistemas operativos mañana terminar planificacion procesos', ctx: 'Entrega del TP de Sistemas Operativos mañana, terminar la sección de planificación de procesos #recordatorio #estudio', day: 22, h: 9, m: 30 },
  { text: 'regar planta domingos', ctx: 'Recordatorio semanal de regar la planta los domingos #recordatorio', day: 22, h: 11, m: 0 },
  { text: 'empezar dark en netflix dicen q engancha', ctx: 'Serie recomendada para ver: Dark en Netflix #info', day: 22, h: 16, m: 0 },
  { text: 'plantas colgantes en la ventana del living', ctx: 'Idea de decoración con plantas colgantes en el living #idea', day: 22, h: 18, m: 30 },

  // ── Day 23 · June 22 (Mon) ────────────────────────────────────────
  { text: 'tp so entregado  a esperar la nota', ctx: 'Trabajo práctico de Sistemas Operativos entregado #estudio', day: 23, h: 10, m: 0 },
  { text: 'dermatologo 22/6 14hs bolivar 850 cons 6', ctx: 'Turno con el dermatólogo el 22 de junio a las 14hs en Bolívar 850 #recordatorio #evento', day: 23, h: 10, m: 5 },
  { text: 'service auto 25/6 10hs taller de siempre', ctx: 'Servicio de mantenimiento del auto el 25 de junio a las 10hs #recordatorio', day: 23, h: 18, m: 0 },

  // ── Day 24 · June 23 (Tue) ────────────────────────────────────────
  { text: 'backup bd produccion cron diario 3am', ctx: 'Programar backup diario de la base de datos de producción #trabajo #recordatorio', day: 24, h: 9, m: 0 },
  { text: 'parciales 8/7 paradigmas y 15/7 sistemas', ctx: 'Fechas de parciales: 8 y 15 de julio #recordatorio #estudio #evento', day: 24, h: 12, m: 30 },
  { text: 'teatro colon el cancer 27/6 20hs no olvidar', ctx: 'Recordatorio de la obra El Cáncer en el Teatro Colón el 27 de junio #evento #recordatorio', day: 24, h: 16, m: 0 },
  { text: 'actualizar readme repo instrucciones instalacion', ctx: 'Actualizar el README del repositorio con instrucciones de instalación #trabajo #recordatorio', day: 24, h: 20, m: 0 },

  // ── Day 25 · June 24 (Wed) ────────────────────────────────────────
  { text: 'reunion hr hoy 14hs preparar preguntas carrera y crecimiento', ctx: 'Reunión de feedback con HR, preparar preguntas sobre carrera #trabajo #evento', day: 25, h: 8, m: 0 },
  { text: 'inyeccion dependencias las dependencias vienen de afuera no se crean adentro facilita tests', ctx: 'Apunte sobre el patrón de inyección de dependencias #estudio', day: 25, h: 12, m: 0 },
  { text: 'firmar contrato alquiler 1/7 11hs inmobiliaria llevar garante recibo sueldo', ctx: 'Firma del contrato de alquiler el 1 de julio, llevar documentos #evento #recordatorio', day: 25, h: 15, m: 30 },
  { text: 'regar planta domingo', ctx: 'Recordatorio de regar la planta los domingos #recordatorio', day: 25, h: 18, m: 0 },
  { text: 'escribir post segundo cerebro whatsapp', ctx: 'Escribir un post sobre el concepto de segundo cerebro con WhatsApp #idea', day: 25, h: 22, m: 0 },

  // ── Day 26 · June 25 (Thu) ────────────────────────────────────────
  { text: 'auto service 10hs dsp super', ctx: 'Servicio del auto hoy a las 10hs y después supermercado #recordatorio', day: 26, h: 7, m: 30 },
  { text: 'idea compartir nota directo a whatsapp share nativo', ctx: 'Idea de feature para compartir notas desde la app a WhatsApp #idea #trabajo', day: 26, h: 11, m: 0 },
  { text: 'cumple lucia hoy  mandarle msj', ctx: 'Cumpleaños de Lucía, mandarle un mensaje de felicitaciones #evento #recordatorio', day: 26, h: 14, m: 0 },
  { text: 'logo minimalista solo cerebro ondas sin texto', ctx: 'Idea de diseño minimalista para el logo de BrainTwo #idea', day: 26, h: 17, m: 30 },

  // ── Day 27 · June 26 (Fri) ────────────────────────────────────────
  { text: 'hoy teatro el cancer 20hs colon salir 18 30', ctx: 'Hoy es la obra El Cáncer en el Teatro Colón, salir a las 18:30 #evento', day: 27, h: 8, m: 0 },
  { text: 'internet 12500 x mes llamar pedir baja y q mejoren precio', ctx: 'Costo de internet $12.500 por mes, pedir mejora de precio #gasto', day: 27, h: 12, m: 0 },
  { text: 'tarjeta credito vence 5/7 aprox 180000', ctx: 'Vencimiento de la tarjeta de crédito el 5 de julio por ~$180.000 #gasto #recordatorio', day: 27, h: 18, m: 30 },

  // ── Day 28 · June 27 (Sat) ────────────────────────────────────────
  { text: 'anoche estuvo buena la obra recomendar', ctx: 'La obra del teatro estuvo buena, recomendarla #evento', day: 28, h: 10, m: 0 },
  { text: 'tarta jamon y queso masa hojaldre jamon cocido queso cremoso huevo crema', ctx: 'Receta de tarta de jamón y queso con ingredientes #receta', day: 28, h: 12, m: 30 },
  { text: 'pagar 32000 expensas atrasadas', ctx: 'Pagar expensas atrasadas de $32.000 #gasto #recordatorio', day: 28, h: 17, m: 0 },

  // ── Day 29 · June 28 (Sun) ────────────────────────────────────────
  { text: 'esta semana terminar pendientes antes parciales priorizar estudio', ctx: 'Plan para la semana: terminar pendientes antes de los parciales #estudio #recordatorio', day: 29, h: 10, m: 0 },
  { text: 'contrato alquiler 1/7 11hs inmobiliaria', ctx: 'Firma del contrato de alquiler el 1 de julio a las 11hs en la inmobiliaria #evento #recordatorio', day: 29, h: 14, m: 0 },
  { text: 'idea feature modo demo datos ficticios screenshots presentaciones', ctx: 'Idea de feature: modo demo con datos ficticios para screenshots y presentaciones #idea #trabajo', day: 29, h: 18, m: 30 },
  { text: 'argentina cabo verde  comprar cosas xa el finde', ctx: 'Partido Argentina vs Cabo Verde en el mundial, preparar cosas para ver el partido #mundial #evento', day: 29, h: 19, m: 0 },

  // ── Day 30 · June 29 (Mon) ────────────────────────────────────────
  { text: 'arranca semana parciales organizar estudio', ctx: 'Inicio de la semana de parciales, organizar estudio #estudio #recordatorio', day: 30, h: 8, m: 0 },
  { text: 'pedro 2500 ya transferido avisarle q confirme', ctx: 'Transferencia a Pedro ya realizada, pedir confirmación #gasto', day: 30, h: 11, m: 30 },
  { text: 'lavar ropa esta semana no hay tiempo', ctx: 'Lavar la ropa antes de que arranque la semana complicada #recordatorio', day: 30, h: 14, m: 0 },
  { text: 'idea informe agregar capturas app funcionando', ctx: 'Idea para el informe del seminario, agregar capturas de la aplicación funcionando #idea #estudio', day: 30, h: 17, m: 0 },
]

export function seedDemoData(db: DbInstance): void {
  const count = db.countMessages()
  if (count > 0) return

  const insertWithNote = db.raw.transaction(() => {
    for (let i = 0; i < MSGS.length; i++) {
      const m = MSGS[i]
      const ts = BASE + (m.day * 86400 + m.h * 3600 + m.m * 60) * 1000
      const waId = `demo_${String(i + 1).padStart(4, '0')}`

      const result = db.insertMessage({
        wa_msg_id: waId,
        timestamp: ts,
        text: m.text,
        source: 'history-sync',
        kind: 'text',
        from_me: true
      })

      if (result.inserted && result.rowId !== null) {
        db.updateContextNote(result.rowId, m.ctx)
      }
    }
  })

  insertWithNote()
  console.log(`[demo-seed] Seeded ${MSGS.length} messages`)
}
