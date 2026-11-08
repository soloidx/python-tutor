import { topics } from "./curriculum.js";

// Each question has stable IDs so an assessment result can be saved with progress.
const questions = [
  {
    id: "evaluacion-valores",
    topic: "Valores y variables",
    prompt: "¿Qué hace edad = 7?",
    options: [
      "Guarda el valor 7 en edad",
      "Compara edad con 7",
      "Muestra 7 en pantalla",
    ],
    answer: "Guarda el valor 7 en edad",
    explanation: "El signo = asigna un valor a una variable.",
  },
  {
    id: "evaluacion-expresiones",
    topic: "Expresiones y salida",
    prompt: "¿Qué muestra print(2 + 4 * 2)?",
    options: ["12", "14", "10"],
    answer: "10",
    explanation:
      "La multiplicación se calcula primero: 4 * 2 es 8, y 2 + 8 es 10.",
  },
  {
    id: "evaluacion-condicionales",
    topic: "Condicionales",
    prompt: "Con edad = 18, ¿qué muestra este código?",
    code: 'if edad >= 18:\n    print("Puede entrar")\nelse:\n    print("Debe esperar")',
    options: ["Debe esperar", "Puede entrar", "Ambos mensajes"],
    answer: "Puede entrar",
    explanation: "18 >= 18 es verdadero, así que se ejecuta el bloque de if.",
  },
  {
    id: "evaluacion-bucles",
    topic: "Bucles",
    prompt: "¿Qué valores recorre for numero in range(1, 4)?",
    options: ["1, 2, 3 y 4", "0, 1, 2 y 3", "1, 2 y 3"],
    answer: "1, 2 y 3",
    explanation: "range() incluye el inicio y excluye el límite final.",
  },
  {
    id: "evaluacion-funciones",
    topic: "Funciones",
    prompt: "¿Para qué sirve return dentro de una función?",
    options: [
      "Muestra siempre un mensaje",
      "Devuelve un valor a quien llama",
      "Repite la función sin parar",
    ],
    answer: "Devuelve un valor a quien llama",
    explanation:
      "return entrega un resultado que puedes guardar o usar en otra expresión.",
  },
  {
    id: "evaluacion-colecciones",
    topic: "Listas y diccionarios",
    prompt: "¿Qué muestra este código?",
    code: 'personas = [{"nombre": "Ada"}, {"nombre": "Luis"}]\nprint(personas[0]["nombre"])',
    options: ["Luis", "Ada", "nombre"],
    answer: "Ada",
    explanation:
      "El índice 0 obtiene el primer diccionario; la clave nombre obtiene Ada.",
  },
];

// The bootstrap supplies content; the learning UI has no built-in course fallback.
export const initialCourse = {
  id: "python-fundamentos",
  title: "Python Fundamentos",
  description:
    "De tus primeras variables a tus propias funciones. Construye una base sólida, practicando en cada paso.",
  topics,
  assessment: { questions },
};
