// Test-only entry: no route or bundle in the production build imports this file.
import React from 'react';
import { createRoot } from 'react-dom/client';
import App from '../../../src/App.jsx';
import { courseIdentity } from '../../../src/identity.js';
import { initialCourse } from '../content/initialCourse.js';
import '../../../src/styles.css';
const id=courseIdentity('personal','fixture');
const exercise={id:'fixture',type:'code',title:'La respuesta',prompt:'Muestra y guarda 42',starter:'x = 41\nprint(x)',hints:[],success:'Bien.',retry:'Inténtalo otra vez.'};
const topic={...structuredClone(initialCourse.topics[0]),id:'tema-fixture',title:'Tema personal',exercises:[exercise]};
const course={id,title:'Curso personal de fixture',description:'Curso suministrado solo en la prueba.',topics:[topic]};
const publication={catalog:{revision:'fixture-personal',courses:[{id}],learningPaths:[{id:'ruta-fixture',title:'Ruta personal de fixture',description:'Ruta suministrada solo en la prueba.',courseIds:[id]}]},courses:{[id]:course},iconFiles:{}};
const execution={origin:'http://127.0.0.1:8872',rules:[{kind:'stdout',equals:'42'},{kind:'variable',name:'x',equals:42}]};
const resolver = new URLSearchParams(location.search).has('unavailable') ? undefined : (courseId, item) => courseId===id && item.id===exercise.id ? execution : null;
createRoot(document.getElementById('root')).render(<App publication={publication} personalExecutionFor={resolver}/>);
