// Authored lessons are data: add topics without changing the Python runner.
// A check is a Python expression evaluated in a fresh execution namespace.
// `_output` contains the printed output (without a trailing newline).
export const topics = [
  {
    id: "valores-variables",
    title: "Valores y variables",
    duration: "12 min",
    summary: "Dale un nombre a tus primeras ideas.",
    explanation: [
      'Un valor es un dato: un número como 20 o un texto como "Ada". Los textos se escriben entre comillas.',
      "Una variable es un nombre que guarda un valor. Usa el signo = para asignarlo. Después puedes usar ese nombre o darle un nuevo valor.",
      "print() muestra un valor en la salida. Prueba el ejemplo y luego resuelve los dos ejercicios.",
    ],
    example: 'ciudad = "Lima"\nprint(ciudad)\n\naño = 2026\nprint(año)',
    takeaway:
      "El signo = asigna un valor; no es una comparación. Python distingue mayúsculas y minúsculas: edad y Edad son nombres diferentes.",
    exercises: [
      {
        id: "saludo",
        title: "Tu primera variable",
        prompt:
          'Crea una variable llamada nombre con el texto "Ada". Muestra Hola, Ada usando esa variable.',
        starter:
          '# Guarda un nombre y úsalo en el saludo\nnombre = ""\nprint("Hola, " + nombre)',
        hints: [
          "Los textos necesitan comillas. Asigna el texto a la variable nombre con =.",
          'Escribe nombre = "Ada" y usa print("Hola, " + nombre).',
        ],
        check: 'nombre == "Ada" and _output == "Hola, Ada"',
        success:
          "Guardaste un texto en una variable y lo usaste para construir un saludo.",
        retry:
          'Revisa que nombre guarde "Ada" y que la salida sea exactamente Hola, Ada.',
      },
      {
        id: "cumpleanos",
        title: "Un valor que cambia",
        prompt:
          "Guarda 20 en edad. Después aumenta su valor en 1 usando la variable y muestra la nueva edad: 21.",
        starter: "# Un año más\nedad = 20\n# Actualiza edad aquí\nprint(edad)",
        hints: [
          "Puedes usar el valor actual de edad para calcular el siguiente.",
          "Después de edad = 20, escribe edad = edad + 1 y muestra edad con print().",
        ],
        check: 'type(edad) is int and edad == 21 and _output == "21"',
        success: "Actualizaste una variable y mostraste su nuevo valor.",
        retry:
          "La variable edad debe guardar el número 21 y la salida debe mostrar 21.",
      },
    ],
  },
  {
    id: "expresiones-salida",
    title: "Expresiones y salida",
    duration: "12 min",
    summary: "Combina valores y muestra tus resultados.",
    explanation: [
      "Una expresión combina valores y operadores para calcular un resultado: 2 + 3 vale 5. Usa + para sumar, - para restar, * para multiplicar y / para dividir.",
      "Python multiplica y divide antes de sumar y restar. Los paréntesis cambian el orden: (2 + 3) * 4 vale 20.",
      "Guarda el resultado en una variable o pásalo a print(). Con varios argumentos separados por comas, print() añade un espacio entre los valores.",
    ],
    example:
      'precio = 5\ncantidad = 2\ntotal = precio * cantidad\nprint("Total:", total)',
    takeaway:
      "Calcular un valor no lo muestra automáticamente. Usa print() para ver el resultado en la consola.",
    exercises: [
      {
        id: "total-compra",
        title: "Calcula una compra",
        prompt:
          "Guarda 8 en precio y 3 en cantidad. Calcula total multiplicando ambas variables y muestra 24.",
        starter: "precio = 8\ncantidad = 3\ntotal = 0\nprint(total)",
        hints: [
          "El operador * multiplica dos números.",
          "Calcula total = precio * cantidad y muestra total con print().",
        ],
        check:
          'precio == 8 and cantidad == 3 and total == 24 and _output == "24"',
        success: "Calculaste un resultado a partir de dos variables.",
        retry: "Usa precio = 8 y cantidad = 3; total y la salida deben ser 24.",
      },
      {
        id: "mensaje-puntos",
        title: "Un mensaje con resultado",
        prompt:
          "Suma 10 + 5 y guarda el resultado en puntos. Muestra exactamente Puntos: 15 usando print() con texto y la variable.",
        starter: 'puntos = 0\nprint("Puntos:", puntos)',
        hints: [
          "Primero calcula puntos con +. print() puede recibir un texto y un número separados por una coma.",
          'Escribe puntos = 10 + 5 y después print("Puntos:", puntos).',
        ],
        check: 'puntos == 15 and _output == "Puntos: 15"',
        success: "Combinaste un cálculo y un mensaje en la salida.",
        retry:
          "puntos debe valer 15 y la salida debe ser exactamente Puntos: 15.",
      },
    ],
  },
  {
    id: "condicionales",
    title: "Condicionales",
    duration: "15 min",
    summary: "Haz que tu programa tome decisiones.",
    explanation: [
      "Una condición da True (verdadero) o False (falso). Compara valores con == (igual), != (diferente), >, <, >= o <=.",
      "if ejecuta un bloque cuando la condición es verdadera. else ejecuta una alternativa cuando es falsa. Escribe dos puntos al final de if y else, y cuatro espacios delante de las instrucciones del bloque.",
      "El operador % calcula el resto de una división. Si numero % 2 == 0, el número es par. Puedes combinar condiciones con and (ambas) u or (al menos una).",
    ],
    example:
      'temperatura = 25\nif temperatura >= 24:\n    print("Hace calor")\nelse:\n    print("Hace fresco")',
    takeaway:
      "= asigna; == compara. La sangría indica qué instrucciones pertenecen a cada bloque.",
    exercises: [
      {
        id: "entrada-edad",
        title: "Una decisión por edad",
        prompt:
          "Guarda 20 en edad. Usa if para mostrar Puede entrar si edad es mayor o igual a 18; en caso contrario, muestra Debe esperar.",
        starter: "edad = 20\n# Compara edad y elige un mensaje",
        hints: [
          "Compara edad >= 18 en un if. Añade una alternativa con else.",
          'Escribe if edad >= 18: y debajo, con cuatro espacios, print("Puede entrar"). Usa else: para print("Debe esperar").',
        ],
        check: 'edad == 20 and _output == "Puede entrar"',
        success: "Elegiste el mensaje correspondiente a la edad.",
        retry: "Usa edad = 20. Para esa edad la salida debe ser Puede entrar.",
      },
      {
        id: "par-impar",
        title: "¿Par o impar?",
        prompt:
          "Guarda 7 en numero. Si numero % 2 == 0, muestra Par; en caso contrario, muestra Impar.",
        starter: "numero = 7\n# Decide si el número es par o impar",
        hints: [
          "El resto de dividir un número par entre 2 es 0. Aquí debes ejecutar la alternativa.",
          'Usa if numero % 2 == 0: con print("Par") y un else: con print("Impar"). Indenta ambos print().',
        ],
        check: 'numero == 7 and _output == "Impar"',
        success: "Usaste el resto de una división para elegir una alternativa.",
        retry: "Con numero = 7 la salida debe ser exactamente Impar.",
      },
    ],
  },
  {
    id: "bucles",
    title: "Bucles",
    duration: "15 min",
    summary: "Repite instrucciones sin repetir tu código.",
    explanation: [
      "Un bucle repite un bloque de instrucciones. for recorre una secuencia de valores. range(1, 4) produce 1, 2 y 3: el límite final no se incluye.",
      "while repite mientras una condición sea verdadera. Actualiza la variable de la condición dentro del bloque para que el bucle termine.",
      "Un acumulador empieza con un valor, por ejemplo total = 0, y lo actualizas en cada repetición. La sangría distingue lo que se repite de lo que sucede una sola vez después del bucle.",
    ],
    example:
      'for paso in range(1, 4):\n    print("Paso", paso)\nprint("Listo")',
    takeaway:
      "Usa cuatro espacios dentro del bucle. Si un while no termina, pulsa Detener ejecución y revisa cómo cambia su condición.",
    exercises: [
      {
        id: "contar-tres",
        title: "Cuenta hasta tres",
        prompt:
          "Usa for y range() para mostrar 1, 2 y 3, cada uno en una línea.",
        starter: "for numero in range(1, 2):\n    print(numero)",
        hints: [
          "range(inicio, fin) no incluye fin. El valor final debe estar después de 3.",
          "Recorre range(1, 4) y muestra numero dentro del for con cuatro espacios de sangría.",
        ],
        check: '_output == "1\\n2\\n3"',
        success: "Repetiste una instrucción para cada número de la secuencia.",
        retry:
          "La salida debe tener tres líneas: 1, 2 y 3. Revisa el límite final de range().",
      },
      {
        id: "sumar-cuatro",
        title: "Suma paso a paso",
        prompt:
          "Empieza con total = 0 y numero = 1. Usa while para sumar los números del 1 al 4 en total. Aumenta numero en cada vuelta y al terminar muestra total: 10.",
        starter:
          "total = 0\nnumero = 1\n# Acumula los números con while\nprint(total)",
        hints: [
          "Repite mientras numero <= 4. Dentro del bucle suma numero a total y aumenta numero en 1.",
          "Usa while numero <= 4: con total = total + numero y numero = numero + 1 dentro. Deja print(total) fuera del bucle.",
        ],
        check: 'total == 10 and numero == 5 and _output == "10"',
        success:
          "Acumulaste valores y terminaste el bucle al cambiar su condición.",
        retry:
          "Al terminar, total debe ser 10, numero debe ser 5 y la salida debe mostrar solo 10.",
      },
    ],
  },
  {
    id: "funciones",
    title: "Funciones",
    duration: "15 min",
    summary: "Dale un nombre a una tarea y úsala varias veces.",
    explanation: [
      "Una función reúne instrucciones. Declárala con def, su nombre, paréntesis y dos puntos. Su bloque lleva cuatro espacios de sangría.",
      "Los parámetros son los nombres que recibe la función. Al llamarla, pasas valores entre paréntesis: doble(4) entrega 4 al parámetro numero.",
      "return devuelve un resultado para usarlo después. print() lo muestra. Definir una función no la ejecuta: necesitas llamarla.",
    ],
    example:
      "def sumar(a, b):\n    return a + b\n\nresultado = sumar(2, 3)\nprint(resultado)",
    takeaway:
      "Una función puede trabajar con diferentes valores. Usa sus parámetros en lugar de devolver siempre un resultado fijo.",
    exercises: [
      {
        id: "doble",
        title: "El doble de un número",
        prompt:
          "Define doble(numero) para devolver el número multiplicado por 2. Muestra doble(4): 8. Comprobaremos también otros números.",
        starter: "def doble(numero):\n    return 0\n\nprint(doble(4))",
        hints: [
          "El parámetro numero contiene el valor recibido. return debe devolver el cálculo.",
          "Dentro de doble escribe return numero * 2. Fuera de la función, muestra print(doble(4)).",
        ],
        check:
          'callable(doble) and doble(4) == 8 and doble(0) == 0 and doble(-3) == -6 and _output == "8"',
        success:
          "Creaste una función que calcula el doble para distintos valores.",
        retry:
          "doble debe devolver su parámetro multiplicado por 2, también con cero y números negativos. La salida debe ser 8.",
      },
      {
        id: "saludar",
        title: "Un saludo reutilizable",
        prompt:
          'Define saludar(nombre) para devolver el texto "Hola, " seguido del nombre recibido. Muestra saludar("Ada"): Hola, Ada. Debe funcionar con otros nombres.',
        starter: 'def saludar(nombre):\n    return ""\n\nprint(saludar("Ada"))',
        hints: [
          'Une el texto "Hola, " y el parámetro nombre con +.',
          'Devuelve return "Hola, " + nombre dentro de la función. Después llama print(saludar("Ada")).',
        ],
        check:
          'callable(saludar) and saludar("Ada") == "Hola, Ada" and saludar("Luis") == "Hola, Luis" and _output == "Hola, Ada"',
        success: "Reutilizaste una función con un parámetro de texto.",
        retry:
          "saludar debe devolver el saludo usando el nombre recibido. La salida debe ser Hola, Ada.",
      },
    ],
  },
  {
    id: "listas-diccionarios",
    title: "Listas y diccionarios",
    duration: "18 min",
    summary: "Organiza varios datos en una sola colección.",
    explanation: [
      'Una lista guarda valores en orden, entre corchetes: frutas = ["manzana", "pera"]. El primer elemento tiene índice 0; frutas[1] es "pera".',
      "append() añade un valor al final de una lista. len() cuenta sus elementos y un for permite recorrerlos.",
      'Un diccionario asocia claves con valores, entre llaves: persona = {"nombre": "Ada", "edad": 20}. Consulta o actualiza un dato usando su clave: persona["edad"] = 21.',
    ],
    example:
      'colores = ["rojo", "azul"]\ncolores.append("verde")\nprint(colores[0])\n\nlibro = {"titulo": "Python", "paginas": 100}\nprint(libro["titulo"])',
    takeaway:
      "Las listas usan posiciones desde 0. Los diccionarios usan claves. Un índice o una clave inexistente produce un error.",
    exercises: [
      {
        id: "lista-frutas",
        title: "Una lista que crece",
        prompt:
          'Crea frutas con "manzana" y "pera", en ese orden. Añade "uva" al final con append() y muestra el segundo elemento: pera.',
        starter:
          'frutas = ["manzana", "pera"]\n# Añade una fruta y muestra el segundo elemento',
        hints: [
          'Añade "uva" con frutas.append(). Recuerda que los índices empiezan en 0.',
          'Escribe frutas.append("uva") y después print(frutas[1]).',
        ],
        check: 'frutas == ["manzana", "pera", "uva"] and _output == "pera"',
        success: "Añadiste un elemento a la lista y consultaste su posición.",
        retry:
          "frutas debe contener manzana, pera y uva en ese orden. La salida debe ser pera.",
      },
      {
        id: "ficha-persona",
        title: "Una ficha con claves",
        prompt:
          'Crea persona con las claves "nombre" ("Ada") y "edad" (20). Aumenta la edad en 1 y muestra ambos valores: Ada 21.',
        starter:
          'persona = {"nombre": "Ada", "edad": 20}\n# Actualiza la edad y muestra los datos',
        hints: [
          'Consulta y cambia la edad con persona["edad"]. print() separa sus argumentos con un espacio.',
          'Usa persona["edad"] = persona["edad"] + 1 y después print(persona["nombre"], persona["edad"]).',
        ],
        check:
          'persona == {"nombre": "Ada", "edad": 21} and _output == "Ada 21"',
        success:
          "Consultaste y actualizaste los valores de un diccionario por sus claves.",
        retry:
          "persona debe guardar nombre Ada y edad 21. La salida debe ser Ada 21.",
      },
    ],
  },
];
