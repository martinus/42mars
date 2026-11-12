;redcode-tiny
;name All over the core
;author	G.Labarga
;assert	 CORESIZE==800
;strategy TinyQ^4->paper

     qx equ 504
     qy equ 701

Qs:  sne.x qf+((qx-1)*qy+1)*(((qx-1)*qy)%800), qf+(qx-1)*qy
     seq.x qf+(qx*qy+1)*((qx*qy)%800),         }qf
     jmp   @qlo+1,                             {qf
     sne.x qf+((qx+1)*qy+1)*(((qx+1)*qy)%800), qf+(qx+1)*qy
     jmz.f plch,                                <qf

qf:  mul.x #qx,      #qy    ; decode
     jmz.f @qlo+1,   >qf

qlo: mov   }519,     >qf    ; attack
     mov   }qlo,     {qf
     seq   {qf,      >qf
     djn.f qlo,      >qf

;--- paper constants
	dest1 EQU 23*4 
	dest2 EQU 83*4
	atk EQU 208	;7408

plch:	SPL 2,>23
	SPL 1,}24
	SPL 1,<25
PAPER:	SPL @0,<dest1
	MOV }-1,>-1
	MOV BMB1,>atk
	MOV {PAPER,<LAST
LAST:	JMZ.A @0,dest2
BMB1:	DAT >534,>267

	END Qs

