import { Injectable, inject } from '@angular/core';
import { 
  Firestore, collection, addDoc, query, where, 
  getDocs, doc, setDoc, collectionData, getDoc, updateDoc
} from '@angular/fire/firestore';
import { Observable } from 'rxjs';
// 🌟 Agrega esto en la parte superior de tu database.ts
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
  // ==========================================
  // URL MAESTRA DE GOOGLE APPS SCRIPT (Fases 1 y 2)
  // ==========================================
  private scriptURL = 'https://script.google.com/macros/s/AKfycbyMZ8C9QCOWrEmL95aSGSZjcJLRpSxGxCymWBHkDp90WjGaQBek8APCAwQ169sNccg/exec';

  // ==========================================
  // LECTURA DE CATÁLOGOS (EXCEL)
  // ==========================================
// ==========================================
  // CATÁLOGOS Y MALLAS
  // ==========================================
// 🌟 3. LA FUNCIÓN ACTUALIZADA
  async obtenerCatalogosDesdeExcel(): Promise<{carreras: string[], materias: MateriaCatalogo[]}> {
    try {
      let urlLimpia = this.scriptURL.split('?')[0]; 
      const url = `${urlLimpia}?api=true`;
      
      console.log("🔗 [DEBUG GIETAES] Consultando URL final:", url);
      const response = await fetch(url);
      const data = await response.json();
      
      console.log("📡 [DEBUG GIETAES] Respuesta bruta recibida del Excel:", data);
      
      this.materiasMaster = []; // Limpiamos caché previo
      let carrerasUnicas: Set<string> = new Set();

      // 🌟 ASUMIMOS QUE APPS SCRIPT AHORA DEVUELVE data.mallas COMO UN ARRAY DE FILAS
      if (data.mallas && Array.isArray(data.mallas)) {
        data.mallas.forEach((fila: any) => {
          
          // Validamos que la fila no esté vacía en columnas clave
          if (fila.SEDE && fila.CARRERA && fila.MATERIA && fila.CICLO) {
            
            const nuevaMateria: MateriaCatalogo = {
              sede: fila.SEDE.toString().trim().toUpperCase(),
              carrera: fila.CARRERA.toString().trim().toUpperCase(),
              ciclo: parseInt(fila.CICLO, 10), // Forzamos que sea un número
              nombre: fila.MATERIA.toString().trim().toUpperCase()
            };

            this.materiasMaster.push(nuevaMateria);
            carrerasUnicas.add(nuevaMateria.carrera); // Guardamos la carrera para el registro
          }
        });
      }
      
      return {
        // Convertimos el Set (que evita duplicados) de nuevo a un Array normal y lo ordenamos
        carreras: Array.from(carrerasUnicas).sort(), 
        materias: this.materiasMaster 
      };

    } catch (error) {
      console.error("❌ [DEBUG GIETAES] Error crítico al obtener catálogos:", error);
      return { carreras: [], materias: [] };
    }
  }

  // 🌟 4. FUNCIÓN AUXILIAR PARA LA POSTULACIÓN
  obtenerMateriasMaestras(): MateriaCatalogo[] {
    return this.materiasMaster;
  }
  async guardarPostulacion(datosPostulacion: any): Promise<boolean> {
    try {
      // 1. Guardar en Firebase Firestore (Colección 'Postulaciones')
      // Esto hace que aparezca de inmediato en tu panel de Administración
      const postulacionesRef = collection(this.firestore, 'Postulaciones');
      await addDoc(postulacionesRef, datosPostulacion);

      // 2. Guardar respaldo en tu Google Excel (Apps Script)
      // Usamos el modo 'no-cors' y 'text/plain' para que Google no bloquee la petición de seguridad
      let urlLimpia = this.scriptURL.split('?')[0];
      await fetch(urlLimpia, {
        method: 'POST',
        mode: 'no-cors', 
        headers: {
          'Content-Type': 'text/plain', 
        },
        body: JSON.stringify(datosPostulacion)
      });

      return true;
    } catch (error) {
      console.error("❌ Error al guardar la postulación:", error);
      throw error;
    }
  }

  // ==========================================
  // MOTOR DE DATOS: FILTROS NACIONALES
  // ==========================================
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
      
      // 🌟 SOLUCIÓN: Buscamos en la colección el campo 'correo_google' que coincida con el login
      const q = query(
        collection(this.firestore, 'Administradores'), 
        where('correo_google', '==', correoLimpio)
      );
      
      const snapshot = await getDocs(q);
      return !snapshot.empty; // Devuelve true si encuentra al menos un admin con ese Gmail
    } catch (error) {
      console.error("Error al verificar Admin:", error);
      return false;
    }
  }

  // ==========================================
  // LOGIN Y REGISTRO DE ESTUDIANTES
  // ==========================================
 // ==========================================
  // FUNCIONES DEL LOGIN ACTUALIZADAS
  // ==========================================

// 🌟 NUEVO: Busca al usuario por su cuenta de GMAIL vinculada
// 🌟 ACTUALIZADO: Ahora también busca en la colección ADMINISTRADORES
// ==========================================
  // FUNCIONES DEL LOGIN ACTUALIZADAS (FUSIÓN DE PERFILES)
  // ==========================================
  async verificarUsuarioExistente(correoGoogle: string) {
    const correoLimpio = correoGoogle.toLowerCase().trim();
    
    try {
      let existe = false;
      let superPerfil: any = {};
      let rolMaximo = 'ESTUDIANTE';

      // 🌟 1. Recopilamos datos base de Estudiante (si existen)
      const qEst = query(collection(this.firestore, 'Estudiantes'), where('correo_google', '==', correoLimpio));
      const estSnap = await getDocs(qEst);
      if (!estSnap.empty) {
        existe = true;
        superPerfil = { ...estSnap.docs[0].data() };
        rolMaximo = superPerfil['rol'] || 'ESTUDIANTE';
      }

      // 🌟 2. Recopilamos datos operativos de Tutor/Coordinador (Sede, Carrera, Materias)
      const qTut = query(collection(this.firestore, 'Tutores'), where('correo_google', '==', correoLimpio));
      const tutSnap = await getDocs(qTut);
      if (!tutSnap.empty) {
        existe = true;
        superPerfil = { ...superPerfil, ...tutSnap.docs[0].data() };
        rolMaximo = tutSnap.docs[0].data()['rol'] || 'TUTOR'; 
      }

      // 🌟 3. Recopilamos el Poder Supremo de Administrador
      const qAdmin = query(collection(this.firestore, 'Administradores'), where('correo_google', '==', correoLimpio));
      const adminSnap = await getDocs(qAdmin);
      if (!adminSnap.empty) {
        existe = true;
        superPerfil = { ...superPerfil, ...adminSnap.docs[0].data() };
        rolMaximo = 'ADMIN'; // El rol ADMIN pisa a todos los demás para darte acceso al panel
      }

      if (existe) {
        // Retornamos el rol supremo, pero con TODOS tus datos de Tutor intactos
        return { existe: true, rol: rolMaximo, datos: superPerfil };
      }

      return { existe: false }; 
      
    } catch (error) {
      console.error("Error al verificar existencia de usuario:", error);
      return { existe: false, error: 'Error de conexión con la base de datos' };
    }
  }


// 🌟 Asegúrate de que registrarNuevoEstudiante mande los nuevos datos al Excel
  async registrarNuevoEstudiante(datos: any) {
    try {
      // Guarda en Firebase
      const docRef = doc(this.firestore, 'Estudiantes', datos.correo);
      await setDoc(docRef, datos);

      // Llama a tu Google Apps Script (Asegúrate de que tu script reciba 'sede' y 'contrasena')
      if (this.scriptURL) {
        await fetch(this.scriptURL, {
          method: 'POST',
          mode: 'no-cors',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            opcion: 'registrarEstudiante',
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
    await setDoc(nuevaRef, paquete);
  }

async aceptarTutor(idPostulacion: string, datosPostulacion: any) {
    try {
      const correoID = datosPostulacion.correo.toLowerCase().trim();

      // 1. Actualizamos el estado de la postulación en Firebase
      const postulacionRef = doc(this.firestore, 'Postulaciones', idPostulacion);
      await updateDoc(postulacionRef, { estado_aprobacion: 'ACEPTADO' });

      // 2. Gestionamos el Perfil del Tutor en Firebase (ID usando el Correo Institucional)
      const tutorRef = doc(this.firestore, 'Tutores', correoID);
      const tutorSnap = await getDoc(tutorRef);

      let listaMaterias: string[] = [];
      let horariosFusionados: any = {};
      
      if (tutorSnap.exists()) {
        const datosPrevios = tutorSnap.data();
        listaMaterias = datosPrevios['materias'] || [];
        horariosFusionados = datosPrevios['horarios'] || {}; 
        
        // Agregamos la nueva materia si no ha sido registrada previamente
        if (!listaMaterias.includes(datosPostulacion.materia_postulada)) {
          listaMaterias.push(datosPostulacion.materia_postulada);
        }

        // Fusionamos los nuevos bloques de horario con los que ya tenía guardados
        if (datosPostulacion.disponibilidad_horaria) {
          for (let clave in datosPostulacion.disponibilidad_horaria) {
            horariosFusionados[clave] = datosPostulacion.disponibilidad_horaria[clave];
          }
        }

        // Guardamos los cambios consolidados en el mismo documento del tutor
        await updateDoc(tutorRef, { 
          materias: listaMaterias,
          horarios: horariosFusionados 
        });

      } else {
        // Si es su primera materia aprobada, inicializamos arreglos y objetos limpios
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
          horarios: horariosFusionados, // Guardamos sus horarios iniciales
          estado: 'ACTIVO',
          rol: 'TUTOR'
        };
        await setDoc(tutorRef, nuevoTutor);
      }

      // 3. 🌟 MAGIA PARA EXCEL: Formateamos el total acumulado de sus horarios
      let horariosExcel: any = { LUNES: '', MARTES: '', MIERCOLES: '', JUEVES: '', VIERNES: '', SABADO: '' };

      if (horariosFusionados) {
        for (let clave in horariosFusionados) {
          let [dia, hora] = clave.split('-');
          let modalidad = horariosFusionados[clave];

          // Asignamos las iniciales correspondientes según la modalidad guardada
          let etiqueta = '(P)';
          if (modalidad === 'VIRTUAL') etiqueta = '(V)';
          if (modalidad === 'AMBAS') etiqueta = '(P)(V)';

          let diaClave = dia.toUpperCase().replace('É', 'E').replace('Á', 'A');
          
          if (horariosExcel[diaClave] !== undefined) {
            // Añade un salto de línea si ya hay horas registradas en ese mismo día
            horariosExcel[diaClave] += `${hora.trim()} ${etiqueta}\n`;
          }
        }
      }

      // Creamos el paquete de datos estructurado para enviar a tu Google Apps Script
      const payloadExcel = {
        opcion: 'aceptarTutorOficial', 
        nombre: datosPostulacion.nombre,
        cedula: datosPostulacion.cedula || '',
        ciclo: datosPostulacion.ciclo,
        carrera: datosPostulacion.carrera,
        materias: listaMaterias.join(', '), // Enviamos la lista de todas sus materias unidas por comas
        correo: correoID,
        celular: datosPostulacion.celular || '',
        permanencia: datosPostulacion.permanencia || 'Soy nuevo',
        horarios: horariosExcel
      };

      await this.enviarAExcel(payloadExcel);

    } catch (error) {
      console.error("Error crítico en aceptarTutor:", error);
      throw error;
    }
  }

  // 🌟 ACTUALIZADA: Ahora rastrea si hay materias aprobadas, rechazadas o pendientes
  async verificarEstadoPostulacion(correo: string): Promise<string> {
    try {
      const postQ = query(collection(this.firestore, 'Postulaciones'), where('correo', '==', correo));
      const postSnap = await getDocs(postQ);
      
      if (!postSnap.empty) {
        // ¿Tiene alguna pendiente? Sigue en proceso
        const hayPendientes = postSnap.docs.some(doc => doc.data()['estado_aprobacion'] === 'PENDIENTE');
        if (hayPendientes) return 'PENDIENTE';
        
        // ¿Tiene alguna aceptada? Ya es tutor (al menos de una materia)
        const hayAceptadas = postSnap.docs.some(doc => doc.data()['estado_aprobacion'] === 'ACEPTADO');
        if (hayAceptadas) return 'TUTOR';
        
        // ¿Todas fueron rechazadas?
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
      const url = 'https://script.google.com/macros/s/AKfycbxfbFHADKVpIzIaD2zAS7siM8NkmyuCBfxbXEKIPcmTmQ9XSekLbc4V6Zki1rBkBEcajg/exec?api=coordinadores'; 
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
      let urlLimpia = this.scriptURL.split('?')[0]; 
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

// ==========================================
  // ESTUDIANTES Y RESERVAS
  // ==========================================

  // Generador de códigos tipo "MAT - 001"
  generarCodigoTutoria(materia: string): string {
    const siglas = materia.substring(0, 3).toUpperCase();
    const numeros = Math.floor(1000 + Math.random() * 9000); // 4 dígitos aleatorios
    return `${siglas} - ${numeros}`;
  }

  async agendarTutoria(datosReserva: any) {
    const reservasRef = collection(this.firestore, 'Reservas');
    
    // Le inyectamos el código y el estado inicial antes de guardarlo
    const nuevaReserva = {
      ...datosReserva,
      codigo: this.generarCodigoTutoria(datosReserva.materia),
      estado: 'PENDIENTE', // Inicia esperando la respuesta del tutor
      fecha_solicitud: new Date().toISOString()
    };
    
    return addDoc(reservasRef, nuevaReserva);
  }
  
// Función para leer mis reservas (Actualizada: Visión 360°)
  async obtenerMisTutorias(correo: string, rol: string) {
    try {
      const correoLimpio = correo.toLowerCase().trim();
      console.log(`🔎 DB_SERVICE: Buscando TODAS las reservas (Dadas y Recibidas) para: [${correoLimpio}]`);

      // 1. Buscamos las clases donde este correo va a enseñar (Tutor)
      const qTutor = query(collection(this.firestore, 'Reservas'), where('correoTutor', '==', correoLimpio));
      
      // 2. Buscamos las clases donde este correo va a aprender (Estudiante)
      const qEstudiante = query(collection(this.firestore, 'Reservas'), where('correoEstudiante', '==', correoLimpio));
      
      // Ejecutamos ambas búsquedas al mismo tiempo
      const [snapTutor, snapEstudiante] = await Promise.all([getDocs(qTutor), getDocs(qEstudiante)]);
      
      // Unimos los resultados
      const todosLosDocs = [...snapTutor.docs, ...snapEstudiante.docs];
      
      console.log(`✅ DB_SERVICE: Encontradas ${todosLosDocs.length} reservas en total.`);
      
      return todosLosDocs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (e) {
      console.error("❌ DB_SERVICE: Error crítico trayendo tutorías", e);
      return [];
    }
  }
 async obtenerRolUsuario(correo: string): Promise<string> {
    try {
      const correoID = correo.toLowerCase().trim();
      
      // 1. Revisión de máxima autoridad (Búsqueda por campo correo_google)
      const qAdmin = query(
        collection(this.firestore, 'Administradores'), 
        where('correo_google', '==', correoID)
      );
      const adminSnap = await getDocs(qAdmin);
      if (!adminSnap.empty) return 'ADMIN';

      // 2. Revisión de tutores (Búsqueda por campo correo_google)
      const qTutor = query(
        collection(this.firestore, 'Tutores'), 
        where('correo_google', '==', correoID)
      );
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

      // 1. Buscar si la tutoría existe usando el código
      const qBusqueda = query(collection(this.firestore, 'Reservas'), where('codigo', '==', codigoLimpio));
      const snapshot = await getDocs(qBusqueda);

      if (snapshot.empty) {
        return { exito: false, mensaje: 'El código ingresado no existe o es incorrecto.' };
      }

      // 2. Extraer los datos de la tutoría original
      const tutoriaOriginal = snapshot.docs[0].data();

      // 3. Validar que el estudiante no esté ya en esta tutoría
      const yaEstaEnTutoria = snapshot.docs.some(doc => doc.data()['correoEstudiante'] === correoLimpio);
      if (yaEstaEnTutoria) {
        return { exito: false, mensaje: 'Ya estás registrado en esta tutoría.' };
      }

      // 4. Validar que el tutor no intente unirse a su propia clase como alumno
      if (tutoriaOriginal['correoTutor'] === correoLimpio) {
        return { exito: false, mensaje: 'No puedes unirte como estudiante a tu propia tutoría.' };
      }

      // 5. Buscar el celular del estudiante que se está uniendo (para que el tutor pueda contactarlo)
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

      // 6. Crear la nueva reserva clonada para el compañero
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
        estado: tutoriaOriginal['estado'], // ¡Hereda el estado actual! (Pendiente o Confirmada)
        fecha_solicitud: new Date().toISOString()
      };

      await addDoc(collection(this.firestore, 'Reservas'), nuevaReserva);
      
      return { exito: true, mensaje: `¡Te has unido a la tutoría de ${tutoriaOriginal['materia']} con éxito!` };

    } catch (error) {
      console.error("Error al unirse por código:", error);
      return { exito: false, mensaje: 'Ocurrió un error en el servidor.' };
    }
  }
  // 🌟 NUEVA FUNCIÓN: Verifica si el usuario ya tiene postulaciones en espera
  async verificarPostulacionPendiente(correo: string): Promise<boolean> {
    try {
      const q = query(
        collection(this.firestore, 'Postulaciones'),
        where('correo', '==', correo),
        where('estado_aprobacion', '==', 'PENDIENTE')
      );
      
      const querySnapshot = await getDocs(q);
      
      // Si el resultado NO está vacío, significa que tiene postulaciones pendientes (Retorna TRUE)
      return !querySnapshot.empty; 
    } catch (error) {
      console.error("❌ Error al verificar postulaciones pendientes:", error);
      return false;
    }
  }
  async rechazarPostulacion(idPostulacion: string): Promise<void> {
    try {
      const postRef = doc(this.firestore, 'Postulaciones', idPostulacion);
      // Cambiamos el estado para que el estudiante vea que no cumplió los requisitos
      await updateDoc(postRef, { estado_aprobacion: 'RECHAZADO' });
    } catch (error) {
      console.error("Error al rechazar postulación:", error);
      throw error;
    }
  }
}