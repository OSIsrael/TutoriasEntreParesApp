import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { addIcons } from 'ionicons';
import { bookOutline, logoWhatsapp, addOutline, checkmarkOutline, closeOutline, filterOutline, personCircleOutline, mailOutline, businessOutline, settingsOutline, logOutOutline, peopleOutline } from 'ionicons/icons';
import { DatabaseService } from '../../services/database';
import { IonContent, IonIcon, IonHeader, IonToolbar, NavController } from '@ionic/angular/standalone';
@Component({
  selector: 'app-mis-tutorias',
  templateUrl: './mis-tutorias.page.html',
  styleUrls: ['./mis-tutorias.page.scss'],
  standalone: true,
  imports: [IonContent, IonIcon, CommonModule, FormsModule, IonHeader, IonToolbar]
})
export class MisTutoriasPage {
  private dbService = inject(DatabaseService);
  mostrarModalCodigo: boolean = false;
  codigoIngresado: string = '';
  
  tutorias: any[] = [];
  cargando: boolean = true;
  correoUsuario: string = '';
  rolUsuario: string = '';

  constructor() {
    addIcons({personCircleOutline,mailOutline,businessOutline,bookOutline,settingsOutline,logOutOutline,peopleOutline,logoWhatsapp,addOutline,checkmarkOutline,closeOutline,filterOutline});
  }

  async ionViewWillEnter() {
    this.correoUsuario = localStorage.getItem('correo') || '';
    this.rolUsuario = localStorage.getItem('rol') || 'ESTUDIANTE';
    await this.cargarMisTutorias();
  }
async cargarMisTutorias() {
    this.cargando = true;
    const datosBdd = await this.dbService.obtenerMisTutorias(this.correoUsuario, this.rolUsuario);
    
    this.tutorias = datosBdd.map((res: any) => {
      let colorEstado = '#fde047'; 
      if (res.estado === 'CONFIRMADA') colorEstado = '#34d399'; 
      if (res.estado === 'CANCELADA') colorEstado = '#ef4444'; 

      // 🌟 MAGIA NUEVA: El sistema deduce qué papel juegas en ESTA reserva específica
      const soyElAlumno = (res.correoEstudiante === this.correoUsuario);

      // Si soy el alumno, quiero contactar a mi Tutor. Si soy el tutor, a mi Alumno.
      const celularMostrar = soyElAlumno ? res.celularTutor : res.celularEstudiante;
      const nombreMostrar = soyElAlumno ? res.nombreTutor : res.nombreEstudiante;

      return {
        id: res.id,
        // Agregamos un (T) o (E) sutil para que sepas si la Das o la Recibes
        materia: soyElAlumno ? `${res.materia} (Recibo)` : `${res.materia} (Doy)`,
        codigo: res.codigo || 'SIN CÓDIGO',
        dia: res.dia_elegido || 'Por definir',
        hora: res.hora_elegida || 'Por definir',
        color: colorEstado,
        estado: res.estado,
        celularContacto: celularMostrar,
        nombreContacto: nombreMostrar
      };
    });

    this.cargando = false;
  }

  contactarWhatsApp(celular: string, nombre: string, materia: string) {
    if (!celular) {
      alert("No hay número de contacto disponible.");
      return;
    }
    
    let celFormateado = celular;
    if (celular.startsWith('0')) {
      celFormateado = '593' + celular.substring(1);
    }
    
    const mensaje = encodeURIComponent(`Hola ${nombre}, te escribo por la tutoría de ${materia} agendada en GIETAES.`);
    const urlWa = `https://wa.me/${celFormateado}?text=${mensaje}`;
    window.open(urlWa, '_blank');
  }

  abrirModalCodigo() { this.mostrarModalCodigo = true; }
  cerrarModalCodigo() { this.mostrarModalCodigo = false; this.codigoIngresado = ''; }

  async unirsePorCodigo() {
    if (!this.codigoIngresado || this.codigoIngresado.trim() === '') {
      alert('Por favor, ingresa un código válido.');
      return;
    }

    // Ponemos la app en modo carga para que no toquen nada mientras busca
    this.cargando = true;

    // Llamamos a nuestro nuevo servicio
    const resultado = await this.dbService.unirseATutoriaPorCodigo(
      this.codigoIngresado, 
      this.correoUsuario, 
      localStorage.getItem('nombre') || 'Estudiante'
    );

    // Mostramos el resultado
    alert(resultado.mensaje);

    // Si tuvo éxito, cerramos el modal y recargamos la lista para que vea su nueva tarjeta
    if (resultado.exito) {
      this.cerrarModalCodigo();
      await this.cargarMisTutorias(); 
    } else {
      this.cargando = false; // Solo quitamos el cargando si falló
    }
  }
}