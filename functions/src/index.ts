import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import * as admin from 'firebase-admin';

// Inicializamos el motor de Firebase
admin.initializeApp();

// Este es el Vigilante: Se activa cada vez que se crea un documento en "Notificaciones"
export const enviarNotificacionPush = onDocumentCreated('Notificaciones/{notificacionId}', async (event) => {
    
    const snap = event.data;
    if (!snap) {
      console.log('No hay datos asociados a este evento.');
      return;
    }

    const nuevaNotificacion = snap.data();
    
    // 1. Extraemos los datos del aviso
    const titulo = nuevaNotificacion['titulo'] || 'Nueva Alerta en GIETAES';
    const mensaje = nuevaNotificacion['mensaje'] || 'Tienes una nueva actualización.';
    const rolDestino = nuevaNotificacion['para_rol']; 
    const sedeDestino = nuevaNotificacion['para_sede']; 
    const correoDestino = nuevaNotificacion['para_correo']; 

    try {
      const db = admin.firestore();
      let tokens: string[] = []; // Aquí guardaremos las "matrículas" de los celulares

      // CASO A: Notificación para una persona específica (Ej: Alumno)
      if (correoDestino) {
        const dispositivoDoc = await db.collection('Dispositivos_Push').doc(correoDestino).get();
        if (dispositivoDoc.exists) {
          const token = dispositivoDoc.data()?.['token_dispositivo'];
          if (token) tokens.push(token);
        }
      } 
      // CASO B: Notificación para un grupo (Ej: Todos los Coordinadores de Cuenca)
      else if (rolDestino && sedeDestino) {
        const dispositivosSnapshot = await db.collection('Dispositivos_Push')
          .where('rol', '==', rolDestino)
          .where('sede', '==', sedeDestino)
          .get();
          
        dispositivosSnapshot.forEach(doc => {
          const token = doc.data()['token_dispositivo'];
          if (token) tokens.push(token);
        });
      }

      // Si nadie cumple los requisitos o no han registrado su celular, abortamos
      if (tokens.length === 0) {
        console.log('No se encontraron dispositivos registrados para esta alerta.');
        return;
      }

      // 2. ARMAMOS EL PAQUETE (La clave para que suene con la app cerrada)
      const payload = {
        notification: {
          title: titulo,
          body: mensaje,
        },
        tokens: tokens 
      };

      // 3. Disparamos la notificación a los servidores de Google y Apple
      const response = await admin.messaging().sendEachForMulticast(payload);
      console.log(`¡Éxito! Mensajes enviados: ${response.successCount}. Fallidos: ${response.failureCount}`);
      
      return;
    } catch (error) {
      console.error('Error crítico al enviar la notificación:', error);
      return;
    }
});