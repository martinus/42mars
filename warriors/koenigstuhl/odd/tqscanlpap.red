;redcode-RF22
;name Tiny QScan-LPap
;author Chip Wendell
;strategy Q-scan from Revenge of the Papers, modified for 800 coresize
;strategy followed by paper from 2LPap by Leonardo H. Liporati
;strategy   (constants optimized by Fizmo for tiny LP)
;assert 1
;       CORESIZE==800

org qGo

;constants for the quickscanner
qf	equ 	qKil
qs	equ     20
qd	equ 	400
qi	equ     5
qr	equ     8

qBmb	dat    {32, {1
qGo  	sne    qd+qf+5*qs, qf+5*qs
     	seq    qf+4*qs, {qTab
	jmp    qFas, }qTab
     	sne    qd+qf+8*qs, qf+8*qs
     	seq    qf+7*qs, {qTab-1
     	jmp    qFas, {qFas
	sne    qd+qf+10*qs, qf+10*qs
     	seq    qf+9*qs, {qTab+1
	jmp    qFas, }qFas
	seq    qd+qf+2*qs, qf+2*qs
	jmp    }ad, {qTab	;avoid shooting myself in the foot
	seq    qd+qf+6*qs, qf+6*qs
	djn.a  qFas, {qFas
	seq    qd+qf+3*qs, qf+3*qs
	jmp    qFas, {qd+qf+3*qs+qi+2
	sne    qd+qf+14*qs, qf+14*qs
	seq    qf+13*qs, <qTab
	jmp    qSlo, >qTab
	sne    qd+qf+17*qs, qf+17*qs
	seq    qf+16*qs, <qTab-1
	jmp    qSlo, {qSlo
	seq    qd+qf+11*qs, qf+11*qs
	jmp    qSlo, <qTab
	sne    qd+qf+12*qs, qf+12*qs
	jmz    cpy2, qd+qf+12*qs-qi

qSlo  mov.ba qTab,   qTab
qFas  mul.ab qTab,   qKil
qSki  sne    qBmb-1, @qKil
      add    #qd,    qKil
qLoo  mov.i  qBmb,   @qKil
qKil  mov.i  qBmb,   *qs
ad    add.ab #-qi,    qKil
      djn    qLoo,   #qr
      jmp    cpy2,   <-400

pap2  mov #12, 12
cpy2  mov <pap2, <ptr2
      mov <pap2, <ptr2
      mov <pap2, <ptr2
      jmn cpy2, @pap2
      spl @pap2, <688
ptr2  jmz @0, 613
      dat <1, <1
      dat <1, <1

      dat    528,    697
qTab  dat    484,    653
dSrc  dat    570,    qBmb-5

end


