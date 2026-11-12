;redcode-tiny
;name Endless pain
;author G.Labarga
;assert CORESIZE==800
;strategy TinyQ^4->paper

;--Qscan from "Where's Giles?" by John Metcalf
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
	dest1 EQU 88 
	dest2 EQU 385
	atk1 equ 479
	atk2 equ 523
	trail equ 457

plch:	spl 2,{-75
	spl 2,<-83
	spl 1,}-91
pap:	spl @0,<dest1
	mov }-1,>-1
	mov {atk1,{atk2
	mov {-3,{1
	djn.f *dest2,<trail

	end Qs

