;redcode-tiny
;name TL5 (Tiny Lord 5)
;author Neo
;assert 1
;strategy TinyQ^4->paper/imp

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

	dest equ 875	;60
	src equ 6284	;267
	dst equ 26	;400

plch:	spl 2,>-110
	spl 1,}-114
	spl 1,<-118

	spl @0,<dest
	mov }-1,>-1
	spl @0,<268
	mov }-1,>-1
	mov.i #src,}dst
	mov.i #267,*0
end Qs

