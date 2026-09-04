import { Injectable, inject } from '@angular/core';
import { 
  Firestore, collection, addDoc, query, where, 
  getDocs, doc, setDoc, collectionData, getDoc, updateDoc
} from '@angular/fire/firestore';
import { Observable } from 'rxjs';
import { Storage, ref, uploadBytes, getDownloadURL } from '@angular/fire/storage';

export interface MateriaCatalogo {
  sede: string;
  carrera: string;
  ciclo: number;
  nombre: string;
}

@Injectable({
  providedIn: 'root'
})
export class DatabaseService {
  materiasMaster: MateriaCatalogo[] = [];
  public firestore = inject(Firestore);
  public storage = inject(Storage);

  // 🌟 ELIMINAMOS LA URL QUEMADA Y AGREGAMOS LAS VARIABLES DINÁMICAS
  scriptURL_dinamica: string = '';
  periodo_actual: string = '';

// 🌟 AHORA ACEPTA UN PARÁMETRO PARA FORZAR LA ACTUALIZACIÓN
  async cargarConfiguracionGlobal(forzarActualizacion: boolean = false) {
    if (this.scriptURL_dinamica && !forzarActualizacion) return; 

    try {
      const docRef = doc(this.firestore, 'Configuracion', 'General');
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        this.scriptURL_dinamica = docSnap.data()['url_google_script'];
        this.periodo_actual = docSnap.data()['periodo_actual'];
        console.log(`[SISTEMA] Conectado al Periodo: ${this.periodo_actual}`);
      }
    } catch (error) {
      console.error("Error crítico al cargar configuración global:", error);
    }
  }

  // 🌟 FUNCIÓN AUXILIAR PARA FORMATEAR HORARIOS DEL TUTOR HACIA EXCEL
  formatearHorariosParaExcel(horariosFusionados: any): any {
    let horariosExcel: any = { LUNES: '', MARTES: '', MIERCOLES: '', JUEVES: '', VIERNES: '', SABADO: '' };
    if (horariosFusionados) {
      for (let clave in horariosFusionados) {
        let [dia, hora] = clave.split('-');
        let modalidad = horariosFusionados[clave];
        let etiqueta = modalidad === 'VIRTUAL' ? '(V)' : modalidad === 'AMBAS' ? '(P)(V)' : '(P)';
        let diaClave = dia.toUpperCase().replace('É', 'E').replace('Á', 'A');
        
        if (horariosExcel[diaClave] !== undefined) {
          horariosExcel[diaClave] += `${hora.trim()} ${etiqueta}\n`;
        }
      }
    }
    return horariosExcel;
  }

  async obtenerCatalogosDesdeExcel(): Promise<{carreras: string[], materias: MateriaCatalogo[]}> {
    try {
      await this.cargarConfiguracionGlobal(); // 🌟 Asegura que la URL exista
      if (!this.scriptURL_dinamica) return { carreras: [], materias: [] };

      let urlLimpia = this.scriptURL_dinamica.split('?')[0]; 
      const url = `${urlLimpia}?api=true`;
      
      console.log("[DEBUG GIETAES] Consultando URL final:", url);
      const response = await fetch(url);
      const data = await response.json();
      
      this.materiasMaster = []; 
      let carrerasUnicas: Set<string> = new Set();

      if (data.mallas && Array.isArray(data.mallas)) {
        data.mallas.forEach((fila: any) => {
          if (fila.SEDE && fila.CARRERA && fila.MATERIA && fila.CICLO) {
            const nuevaMateria: MateriaCatalogo = {
              sede: fila.SEDE.toString().trim().toUpperCase(),
              carrera: fila.CARRERA.toString().trim().toUpperCase(),
              ciclo: parseInt(fila.CICLO, 10), 
              nombre: fila.MATERIA.toString().trim().toUpperCase()
            };
            this.materiasMaster.push(nuevaMateria);
            carrerasUnicas.add(nuevaMateria.carrera); 
          }
        });
      }
      
      return { carreras: Array.from(carrerasUnicas).sort(), materias: this.materiasMaster };
    } catch (error) {
      console.error("[DEBUG GIETAES] Error crítico al obtener catálogos:", error);
      return { carreras: [], materias: [] };
    }
  }

  obtenerMateriasMaestras(): MateriaCatalogo[] {
    return this.materiasMaster;
  }

  async guardarPostulacion(datosPostulacion: any): Promise<boolean> {
    try {
      const postulacionesRef = collection(this.firestore, 'Postulaciones');
      
      // 🌟 Le inyectamos el periodo a la postulación antes de guardarla
      await this.cargarConfiguracionGlobal();
      const paqueteFinal = { ...datosPostulacion, periodo: this.periodo_actual };
      await addDoc(postulacionesRef, paqueteFinal);

      let urlLimpia = this.scriptURL_dinamica.split('?')[0];
      await fetch(urlLimpia, {
        method: 'POST',
        mode: 'no-cors', 
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify(paqueteFinal)
      });
      return true;
    } catch (error) {
      console.error("Error al guardar la postulación:", error);
      throw error;
    }
  }

  async obtenerTutoresFiltrados(sede: string, carrera: string) {
    try {
      const q = query(
        collection(this.firestore, 'Tutores'),
        where('sede', '==', sede.toUpperCase()),
        where('carrera', '==', carrera),
        where('estado', '==', 'ACTIVO')
      );
      
      const querySnapshot = await getDocs(q);
      const tutores = querySnapshot.docs.map(doc => ({ 
        id: doc.id, 
        ...doc.data() 
      }));

      return tutores;
    } catch (error) {
      console.error("Error al obtener el motor de tutores:", error);
      return [];
    }
  }

  // ==========================================
  // SEGURIDAD ADMIN
  // ==========================================
  async verificarSiEsAdmin(correo: string): Promise<boolean> {
    try {
      const correoLimpio = correo.toLowerCase().trim();
      const q = query(
        collection(this.firestore, 'Administradores'), 
        where('correo_google', '==', correoLimpio)
      );
      
      const snapshot = await getDocs(q);
      return !snapshot.empty; 
    } catch (error) {
      console.error("Error al verificar Admin:", error);
      return false;
    }
  }

  async verificarUsuarioExistente(correoGoogle: string) {
    const correoLimpio = correoGoogle.toLowerCase().trim();
    
    try {
      let existe = false;
      let superPerfil: any = {};
      let rolMaximo = 'ESTUDIANTE';

      const qEst = query(collection(this.firestore, 'Estudiantes'), where('correo_google', '==', correoLimpio));
      const estSnap = await getDocs(qEst);
      if (!estSnap.empty) {
        existe = true;
        superPerfil = { ...estSnap.docs[0].data() };
        rolMaximo = superPerfil['rol'] || 'ESTUDIANTE';
      }

      const qTut = query(collection(this.firestore, 'Tutores'), where('correo_google', '==', correoLimpio));
      const tutSnap = await getDocs(qTut);
      if (!tutSnap.empty) {
        existe = true;
        superPerfil = { ...superPerfil, ...tutSnap.docs[0].data() };
        rolMaximo = tutSnap.docs[0].data()['rol'] || 'TUTOR'; 
      }
      
      const qAdmin = query(collection(this.firestore, 'Administradores'), where('correo_google', '==', correoLimpio));
      const adminSnap = await getDocs(qAdmin);
      if (!adminSnap.empty) {
        existe = true;
        superPerfil = { ...superPerfil, ...adminSnap.docs[0].data() };
        rolMaximo = 'ADMIN'; 
      }

      if (existe) {
        return { existe: true, rol: rolMaximo, datos: superPerfil };
      }
      return { existe: false }; 
      
    } catch (error) {
      console.error("Error al verificar existencia de usuario:", error);
      return { existe: false, error: 'Error de conexión con la base de datos' };
    }
  }

 async registrarNuevoEstudiante(datos: any) {
    try {
      // 1. Cargamos la configuración (URL y Periodo) una sola vez
      await this.cargarConfiguracionGlobal();

      // 2. Preparamos el paquete inyectándole el periodo actual
      const datosCompletos = {
        ...datos,
        ultimo_periodo_activo: this.periodo_actual
      };
      
      // 3. Guardamos en Firebase (¡Usando datosCompletos!)
      const docRef = doc(this.firestore, 'Estudiantes', datos.correo);
      await setDoc(docRef, datosCompletos);

      // 4. Guardamos en Google Sheets
      if (this.scriptURL_dinamica) {
        await fetch(this.scriptURL_dinamica, {
          method: 'POST',
          mode: 'no-cors',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            opcion: 'registrarEstudiante',
            periodo: this.periodo_actual, 
            ...datos
          })
        });
      }
    } catch (error) {
      console.error("Error al registrar estudiante:", error);
    }
  }

  // ==========================================
  // GESTIÓN POSTULACIONES Y TUTORES
  // ==========================================
  async enviarPostulacion(paquete: any) {
    const nuevaRef = doc(collection(this.firestore, 'Postulaciones'));
    await this.cargarConfiguracionGlobal();
    const paqueteFinal = { ...paquete, periodo: this.periodo_actual };
    await setDoc(nuevaRef, paqueteFinal);
  }

  async aceptarTutor(idPostulacion: string, datosPostulacion: any) {
    try {
      const correoID = datosPostulacion.correo.toLowerCase().trim();
      const postulacionRef = doc(this.firestore, 'Postulaciones', idPostulacion);
      await updateDoc(postulacionRef, { estado_aprobacion: 'ACEPTADO' });

      const tutorRef = doc(this.firestore, 'Tutores', correoID);
      const tutorSnap = await getDoc(tutorRef);

      let listaMaterias: string[] = [];
      let horariosFusionados: any = {};
      
      await this.cargarConfiguracionGlobal(); // 🌟 Obtenemos el periodo

      if (tutorSnap.exists()) {
        const datosPrevios = tutorSnap.data();
        listaMaterias = datosPrevios['materias'] || [];
        horariosFusionados = datosPrevios['horarios'] || {}; 
        
        if (!listaMaterias.includes(datosPostulacion.materia_postulada)) {
          listaMaterias.push(datosPostulacion.materia_postulada);
        }

        if (datosPostulacion.disponibilidad_horaria) {
          for (let clave in datosPostulacion.disponibilidad_horaria) {
            horariosFusionados[clave] = datosPostulacion.disponibilidad_horaria[clave];
          }
        }

        await updateDoc(tutorRef, { 
          materias: listaMaterias,
          horarios: horariosFusionados,
          ultimo_periodo_activo: this.periodo_actual // 🌟 ACTUALIZAMOS SU PERIODO
        });

      } else {
        listaMaterias = [datosPostulacion.materia_postulada];
        horariosFusionados = datosPostulacion.disponibilidad_horaria || {};

        const nuevoTutor = {
          nombre: datosPostulacion.nombre,
          cedula: datosPostulacion.cedula || '',
          ciclo: datosPostulacion.ciclo,
          permanencia: datosPostulacion.permanencia || 'Soy nuevo',
          carrera: datosPostulacion.carrera,
          sede: datosPostulacion.sede || 'CUENCA', 
          correo_google: correoID, 
          celular: datosPostulacion.celular || '',
          correo: correoID, 
          materias: listaMaterias, 
          horarios: horariosFusionados, 
          estado: 'ACTIVO',
          rol: 'TUTOR',
          ultimo_periodo_activo: this.periodo_actual // 🌟 SE REGISTRA CON EL PERIODO ACTUAL
        };
        await setDoc(tutorRef, nuevoTutor);
      }

      let horariosExcel: any = { LUNES: '', MARTES: '', MIERCOLES: '', JUEVES: '', VIERNES: '', SABADO: '' };
      if (horariosFusionados) {
        for (let clave in horariosFusionados) {
          let [dia, hora] = clave.split('-');
          let modalidad = horariosFusionados[clave];
          let etiqueta = '(P)';
          if (modalidad === 'VIRTUAL') etiqueta = '(V)';
          if (modalidad === 'AMBAS') etiqueta = '(P)(V)';
          let diaClave = dia.toUpperCase().replace('É', 'E').replace('Á', 'A');
          
          if (horariosExcel[diaClave] !== undefined) {
            horariosExcel[diaClave] += `${hora.trim()} ${etiqueta}\n`;
          }
        }
      }

      const payloadExcel = {
        opcion: 'aceptarTutorOficial', 
        nombre: datosPostulacion.nombre,
        cedula: datosPostulacion.cedula || '',
        ciclo: datosPostulacion.ciclo,
        carrera: datosPostulacion.carrera,
        materias: listaMaterias.join(', '), 
        correo: correoID,
        celular: datosPostulacion.celular || '',
        permanencia: datosPostulacion.permanencia || 'Soy nuevo',
        horarios: horariosExcel,
        periodo: this.periodo_actual
      };

      await this.enviarAExcel(payloadExcel);

    } catch (error) {
      console.error("Error crítico en aceptarTutor:", error);
      throw error;
    }
  }

  async verificarEstadoPostulacion(correo: string): Promise<string> {
    try {
      const postQ = query(collection(this.firestore, 'Postulaciones'), where('correo', '==', correo));
      const postSnap = await getDocs(postQ);
      
      if (!postSnap.empty) {
        const hayPendientes = postSnap.docs.some(doc => doc.data()['estado_aprobacion'] === 'PENDIENTE');
        if (hayPendientes) return 'PENDIENTE';
        
        const hayAceptadas = postSnap.docs.some(doc => doc.data()['estado_aprobacion'] === 'ACEPTADO');
        if (hayAceptadas) return 'TUTOR';
        
        const todasRechazadas = postSnap.docs.every(doc => doc.data()['estado_aprobacion'] === 'RECHAZADO');
        if (todasRechazadas) return 'RECHAZADO';
      }
      return 'NINGUNA';
    } catch (e) {
      return 'NINGUNA';
    }
  }

  async obtenerTutoresActivos() {
    try {
      const q = query(collection(this.firestore, 'Tutores'), where('estado', '==', 'ACTIVO'));
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
      console.error('Error obteniendo tutores:', error);
      return [];
    }
  }

  async obtenerCoordinadoresDesdeExcel(): Promise<any[]> {
    try {
      await this.cargarConfiguracionGlobal(); // 🌟 Actualizado para usar enlace dinámico
      if (!this.scriptURL_dinamica) return [];

      let urlLimpia = this.scriptURL_dinamica.split('?')[0]; 
      const url = `${urlLimpia}?api=coordinadores`; 
      const respuesta = await fetch(url);
      const texto = await respuesta.text(); 
      try {
        return JSON.parse(texto);
      } catch (jsonError) {
        return [];
      }
    } catch (error) {
      return []; 
    }
  }

  async enviarAExcel(paqueteCompleto: any) {
    try {
      await this.cargarConfiguracionGlobal();
      let urlLimpia = this.scriptURL_dinamica.split('?')[0]; 
      await fetch(urlLimpia, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify(paqueteCompleto)
      });
    } catch (error) {
      console.error('Error puenteando a Excel', error);
    }
  }

  // ==========================================
  // ESTUDIANTES Y RESERVAS
  // ==========================================
  async guardarEstudiante(uid: string, datos: any) {
    const userRef = doc(this.firestore, `Estudiantes/${uid}`);
    return setDoc(userRef, datos, { merge: true });
  }

  obtenerHorarios(): Observable<any[]> {
    const horariosRef = collection(this.firestore, 'HorariosDisponibles');
    return collectionData(horariosRef, { idField: 'id' });
  } 

  generarCodigoTutoria(materia: string): string {
    const siglas = materia.substring(0, 3).toUpperCase();
    const numeros = Math.floor(1000 + Math.random() * 9000); 
    return `${siglas} - ${numeros}`;
  }

  async agendarTutoria(datosReserva: any) {
    await this.cargarConfiguracionGlobal();
    const reservasRef = collection(this.firestore, 'Reservas');
    
    const nuevaReserva = {
      ...datosReserva,
      codigo: this.generarCodigoTutoria(datosReserva.materia),
      estado: 'PENDIENTE', 
      fecha_solicitud: new Date().toISOString(),
      periodo: this.periodo_actual // 🌟 Etiqueta de periodo para las tutorías
    };

    try {
      await addDoc(collection(this.firestore, 'Tutorias_Agendadas'), nuevaReserva); // Corregido para incluir todo
      
      await this.crearNotificacion({
        titulo: '¡Nueva Tutoría Agendada!',
        mensaje: `${datosReserva.nombreEstudiante} ha agendado una tutoría de ${datosReserva.materia} el ${datosReserva.dia_elegido} a las ${datosReserva.hora_elegida}.`,
        tipo: 'TUTORIA',
        correo_destino: datosReserva.correoTutor 
      });
    } catch (error) {
      throw error;
    }
    
    return addDoc(reservasRef, nuevaReserva);
  }
  
  async obtenerMisTutorias(correo: string, rol: string) {
    try {
      const correoLimpio = correo.toLowerCase().trim();
      
      const qTutor = query(collection(this.firestore, 'Reservas'), where('correoTutor', '==', correoLimpio));
      const qEstudiante = query(collection(this.firestore, 'Reservas'), where('correoEstudiante', '==', correoLimpio));
      
      const [snapTutor, snapEstudiante] = await Promise.all([getDocs(qTutor), getDocs(qEstudiante)]);
      
      const todosLosDocs = [...snapTutor.docs, ...snapEstudiante.docs];
      return todosLosDocs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (e) {
      console.error("DB_SERVICE: Error crítico trayendo tutorías", e);
      return [];
    }
  }

  async obtenerRolUsuario(correo: string): Promise<string> {
    try {
      const correoID = correo.toLowerCase().trim();
      
      const qAdmin = query(collection(this.firestore, 'Administradores'), where('correo_google', '==', correoID));
      const adminSnap = await getDocs(qAdmin);
      if (!adminSnap.empty) return 'ADMIN';

      const qTutor = query(collection(this.firestore, 'Tutores'), where('correo_google', '==', correoID));
      const tutorSnap = await getDocs(qTutor);
      if (!tutorSnap.empty) return 'TUTOR';

      return 'ESTUDIANTE';
    } catch (error) {
      console.error("Error al obtener rol:", error);
      return 'ESTUDIANTE'; 
    }
  }

  // ==========================================
  // UNIRSE POR CÓDIGO
  // ==========================================
  async unirseATutoriaPorCodigo(codigoIngresado: string, correoUsuario: string, nombreUsuario: string) {
    try {
      const codigoLimpio = codigoIngresado.toUpperCase().trim();
      const correoLimpio = correoUsuario.toLowerCase().trim();

      const qBusqueda = query(collection(this.firestore, 'Reservas'), where('codigo', '==', codigoLimpio));
      const snapshot = await getDocs(qBusqueda);

      if (snapshot.empty) return { exito: false, mensaje: 'El código ingresado no existe o es incorrecto.' };

      const tutoriaOriginal = snapshot.docs[0].data();
      const yaEstaEnTutoria = snapshot.docs.some(doc => doc.data()['correoEstudiante'] === correoLimpio);
      
      if (yaEstaEnTutoria) return { exito: false, mensaje: 'Ya estás registrado en esta tutoría.' };
      if (tutoriaOriginal['correoTutor'] === correoLimpio) return { exito: false, mensaje: 'No puedes unirte como estudiante a tu propia tutoría.' };

      let celularAlumno = 'Desconocido';
      const estSnap = await getDoc(doc(this.firestore, 'Estudiantes', correoLimpio));
      if (estSnap.exists() && estSnap.data()['celular']) {
        celularAlumno = estSnap.data()['celular'];
      } else {
        const tutSnap = await getDoc(doc(this.firestore, 'Tutores', correoLimpio));
        if (tutSnap.exists() && tutSnap.data()['celular']) {
          celularAlumno = tutSnap.data()['celular'];
        }
      }

      const nuevaReserva = {
        correoEstudiante: correoLimpio,
        nombreEstudiante: nombreUsuario,
        celularEstudiante: celularAlumno,
        correoTutor: tutoriaOriginal['correoTutor'],
        nombreTutor: tutoriaOriginal['nombreTutor'],
        celularTutor: tutoriaOriginal['celularTutor'],
        materia: tutoriaOriginal['materia'],
        dia_elegido: tutoriaOriginal['dia_elegido'],
        hora_elegida: tutoriaOriginal['hora_elegida'],
        codigo: codigoLimpio, 
        estado: tutoriaOriginal['estado'], 
        fecha_solicitud: new Date().toISOString(),
        periodo: tutoriaOriginal['periodo'] || this.periodo_actual // 🌟 Hereda el periodo
      };

      await addDoc(collection(this.firestore, 'Reservas'), nuevaReserva);
      return { exito: true, mensaje: `¡Te has unido a la tutoría de ${tutoriaOriginal['materia']} con éxito!` };
    } catch (error) {
      console.error("Error al unirse por código:", error);
      return { exito: false, mensaje: 'Ocurrió un error en el servidor.' };
    }
  }

  async verificarPostulacionPendiente(correo: string): Promise<boolean> {
    try {
      const q = query(
        collection(this.firestore, 'Postulaciones'),
        where('correo', '==', correo),
        where('estado_aprobacion', '==', 'PENDIENTE')
      );
      const querySnapshot = await getDocs(q);
      return !querySnapshot.empty; 
    } catch (error) {
      console.error("Error al verificar postulaciones pendientes:", error);
      return false;
    }
  }

  async rechazarPostulacion(idPostulacion: string): Promise<void> {
    try {
      const postRef = doc(this.firestore, 'Postulaciones', idPostulacion);
      await updateDoc(postRef, { estado_aprobacion: 'RECHAZADO' });
    } catch (error) {
      console.error("Error al rechazar postulación:", error);
      throw error;
    }
  }

  // 🌟 MOTOR MAESTRO DE NOTIFICACIONES
  async crearNotificacion(datos: any) {
    try {
      const notificacionRef = doc(collection(this.firestore, 'Notificaciones'));
      await setDoc(notificacionRef, {
        titulo: datos.titulo,
        mensaje: datos.mensaje,
        tipo: datos.tipo,
        correo_destino: datos.correo_destino,
        sede_destino: datos.sede_destino || 'GLOBAL',
        rol_destino: datos.rol_destino || 'ESTUDIANTE', 
        fecha: new Date().toISOString(),
        leida_por: [] 
      });
    } catch (error) {
      console.error("Error al crear notificación:", error);
    }
  }

  async obtenerNotificacionesUsuario(correo: string, rol: string, sede: string, contextoPanel: string = 'ESTUDIANTE') {
    try {
      const q = query(
        collection(this.firestore, 'Notificaciones'),
        where('correo_destino', '==', correo),
        where('rol_destino', '==', contextoPanel)
      );
      
      const querySnapshot = await getDocs(q);
      let notificaciones: any[] = [];
      querySnapshot.forEach((doc) => {
        notificaciones.push({ id: doc.id, ...doc.data() });
      });

      return notificaciones.sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());
    } catch (error) {
      console.error("Error obteniendo notificaciones:", error);
      return [];
    }
  }

  async marcarNotificacionLeida(idNotificacion: string, correoUsuario: string) {
    try {
      const notifRef = doc(this.firestore, 'Notificaciones', idNotificacion);
      const notifSnap = await getDoc(notifRef);

      if (notifSnap.exists()) {
        const datos = notifSnap.data();
        const leidaPor: string[] = datos['leida_por'] || [];

        if (!leidaPor.includes(correoUsuario)) {
          leidaPor.push(correoUsuario);
          await updateDoc(notifRef, { leida_por: leidaPor });
        }
      }
    } catch (error) {
      console.error("Error al marcar como leída:", error);
    }
  }

  async obtenerEstudiantesPorCarrera(carrera: string) {
    try {
      const q = query(collection(this.firestore, 'Estudiantes'), where('carrera', '==', carrera.toUpperCase()));
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => doc.data());
    } catch (error) {
      console.error("Error obteniendo estudiantes:", error);
      return [];
    }
  }

  async guardarAsistencia(datosAsistencia: any) {
    try {
      await this.cargarConfiguracionGlobal();

      let nombreLimpio = 'ESTUDIANTE_DESCONOCIDO';
      if (datosAsistencia.estudiante_info) {
        const nombreCrudo = datosAsistencia.estudiante_info.split(' - ')[0].trim();
        nombreLimpio = nombreCrudo.replace(/\s+/g, '_'); 
      }

      const idUnico = `${nombreLimpio}_${new Date().getTime()}`;
      const nuevaRef = doc(this.firestore, 'Asistencias', idUnico);
      
      // 🌟 Añadimos el periodo al guardar la asistencia en Firebase
      const asistenciaFinal = { ...datosAsistencia, periodo: this.periodo_actual };
      await setDoc(nuevaRef, asistenciaFinal);

      const payloadExcel = {
        opcion: 'registrarAsistencia',
        ...asistenciaFinal
      };

      if (this.scriptURL_dinamica) {
        await fetch(this.scriptURL_dinamica, {
          method: 'POST',
          mode: 'no-cors',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payloadExcel)
        });
      }
      
    } catch (error) {
      console.error('Error al guardar asistencia:', error);
      throw error;
    }
  }

  async obtenerDocentesDesdeExcel(): Promise<string[]> {
    try {
      await this.cargarConfiguracionGlobal();
      if (!this.scriptURL_dinamica) return [];

      let urlLimpia = this.scriptURL_dinamica.split('?')[0];
      const url = `${urlLimpia}?api=true`;
      const response = await fetch(url);
      const data = await response.json();
      return data.docentes || [];
    } catch (error) {
      console.error("Error obteniendo docentes:", error);
      return [];
    }
  }
  // ==========================================
  // 🌟 SUBIDA DE ARCHIVOS (PDF)
  // ==========================================
  async subirPDFRendimiento(archivo: File, cedula: string): Promise<string> {
    try {
      // Creamos una ruta única usando la cédula y la fecha para que no se sobreescriban
      const timestamp = new Date().getTime();
      const rutaArchivo = `RendimientoAcademico/${cedula}_${timestamp}.pdf`;
      const referencia = ref(this.storage, rutaArchivo);

      // Subimos el archivo
      await uploadBytes(referencia, archivo);
      
      // Obtenemos el link público para descargarlo
      const urlDescarga = await getDownloadURL(referencia);
      return urlDescarga;
    } catch (error) {
      console.error("Error al subir el PDF:", error);
      throw error;
    }
  }
}