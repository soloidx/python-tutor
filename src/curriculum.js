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
];
