import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ExerciseWorkspace } from '../../../src/ExerciseWorkspace.jsx';
import { Practice } from '../../../src/Practice.jsx';
import '../../../src/styles.css';
const exercise = {id:'fixture',type:'code',title:'La respuesta',prompt:'Muestra y guarda 42',starter:'x = 41\nprint(x)',hints:[],success:'Bien.',retry:'Inténtalo otra vez.'};
const execution = {origin:'http://127.0.0.1:8872',rules:[{kind:'stdout',equals:'42'},{kind:'variable',name:'x',equals:42}]};
const entry = {key:'fixture',status:'pending',exercise,topic:{title:'Tema'},course:{title:'Curso'},work:undefined};
function Fixture() {
 const [view,setView]=useState('learn'),[learned,setLearned]=useState(false);
 const [round,setRound]=useState({id:'fixture-round',revision:'fixture',entries:[entry],currentId:'fixture'});
 return <><nav><button onClick={()=>setView('learn')}>Aprender</button><button onClick={()=>setView('practice')}>Práctica</button></nav><p data-testid="learning-progress">{learned?'Aprendido':'Pendiente de aprender'}</p>{view==='learn' ? <ExerciseWorkspace exercise={exercise} personalExecution={execution} onComplete={()=>setLearned(true)}/> : <Practice round={round} saved onChange={setRound} personalExecutionFor={()=>execution}/>}</>;
}
createRoot(document.getElementById('root')).render(<Fixture/>);
