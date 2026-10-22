import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonApp, IonRouterOutlet, IonModal, IonButton, IonIcon, ToastController } from '@ionic/angular/standalone';
import { Firestore, collection, query, where, getDocs, doc, updateDoc, deleteDoc } from '@angular/fire/firestore';
import { addIcons } from 'ionicons';
import { starOutline, star, checkmarkCircleOutline, closeCircleOutline } from 'ionicons/icons';
import { DatabaseService } from './services/database';

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  styleUrls: ['app.component.scss'],
  standalone: true,
  imports: [IonApp, IonRouterOutlet, CommonModule, FormsModule, IonModal, IonButton, IonIcon],
})
export class AppComponent implements OnInit {
  private firestore = inject(Firestore);
  private dbService = inject(DatabaseService);
  private toastController = inject(ToastController);

  evaluacionPendiente: any = null;
  mostrarModalEvaluacion: boolean = false;
  enviandoEval: boolean = false;

  // Las 3 preguntas obligatorias del Estudiante
  respuestas = {
    p1: 0, // ¿Comprendiste mejor el tema?
    p2: 0, // ¿La sesión aclaró tus dudas?
    p3: 0  // ¿Me ayudará a alcanzar mis metas?
  };

  constructor() {
    addIcons({ starOutline, star, checkmarkCircleOutline, closeCircleOutline });
  }

  ngOnInit() {
    // 🌟 Vigilante Constante: Revisa si hay evaluaciones cada vez que la app respira
    setInterval(() => {
      this.verificarEvaluacionesPendientes();
    }, 5000); // Revisa cada 5 segundos de forma silenciosa
  }

  async verificarEvaluacionesPendientes() {
    // Si ya estamos evaluando o no hay usuario logueado, no hacemos nada
    if (this.mostrarModalEvaluacion) return;
    const correoUsuario = localStorage.getItem('correo');
    if (!correoUsuario) return;

    try {
      const q = query(
        collection(this.firestore, 'EvaluacionesPendientes'), 
        where('correoEstudiante', '==', correoUsuario),
        where('estado', '==', 'PENDIENTE')
      );
      
      const snap = await getDocs(q);
      
      if (!snap.empty) {
        // Encontramos una clase sin evaluar, ¡Levantamos el cerrojo!
        const evalDoc = snap.docs[0];
        this.evaluacionPendiente = { id: evalDoc.id, ...evalDoc.data() };
        this.mostrarModalEvaluacion = true;
      }
    } catch (error) {
      console.error("Error buscando evaluaciones", error);
    }
  }

 async enviarEvaluacion() {
    if (this.respuestas.p1 === 0 || this.respuestas.p2 === 0 || this.respuestas.p3 === 0) {
      this.mostrarAviso('Debes calificar las 3 preguntas con estrellas para continuar.', 'error');
      return;
    }

    this.enviandoEval = true;

    try {
      // 1. Armamos el paquete para Google Apps Script (Excel)
      const payloadExcel = {
        opcion: 'guardarEvaluacionEstudiante',
        correoEstudiante: localStorage.getItem('correo'),
        nombreEstudiante: localStorage.getItem('nombre'),
        nombreTutor: this.evaluacionPendiente.nombreTutor,
        materia: this.evaluacionPendiente.materia,
        fecha_clase: this.evaluacionPendiente.fecha_clase,
        pregunta_1: this.respuestas.p1,
        pregunta_2: this.respuestas.p2,
        pregunta_3: this.respuestas.p3
      };

      // 🌟 AHORA SÍ LLAMAMOS A LA FUNCIÓN QUE CREAMOS EN DATABASE.TS
      await this.dbService.guardarEvaluacionEstudiante(payloadExcel);

      // 2. Destruimos el "Cerrojo" en Firebase
      await deleteDoc(doc(this.firestore, 'EvaluacionesPendientes', this.evaluacionPendiente.id));

      this.mostrarAviso('¡Gracias por evaluar! Ahora puedes continuar.', 'exito');
      
      // 3. Liberamos la pantalla
      this.mostrarModalEvaluacion = false;
      this.evaluacionPendiente = null;
      this.respuestas = { p1: 0, p2: 0, p3: 0 };

    } catch (error) {
      this.mostrarAviso('Hubo un error de conexión al enviar.', 'error');
    } finally {
      this.enviandoEval = false;
    }
  }

  async mostrarAviso(mensaje: string, tipo: 'exito' | 'error' = 'exito') {
    const toast = await this.toastController.create({
      message: mensaje,
      duration: 3000,
      position: 'top',
      icon: tipo === 'error' ? 'close-circle-outline' : 'checkmark-circle-outline',
      cssClass: tipo === 'error' ? 'toast-error' : 'toast-exito',
      mode: 'ios'
    });
    await toast.present();
  }
}