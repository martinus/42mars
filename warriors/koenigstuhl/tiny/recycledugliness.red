;redcode-tiny
;name Recycled ugliness
;author G.Labarga
;assert CORESIZE==800
;strategy TinyQ^4->Paper

; [ QSCAN from Digital Swarm ]

Qs:  sne.x qf+592,   qf+656 ; scan
     seq.x qf+176,   qf+752
     djn.f @qlo+1,   @qlo+1
     sne.x qf+500,   qf+475
     seq.x qf+700,   }qf
     jmp   @qlo+1,   {qf
     sne.x qf+550,   qf+125
     jmz.f plch,      <qf

qf:  mul.x #300,     #625   ; decode
     jmz.f @qlo+1,   >qf

qlo: mov   {519,     >qf    ; attack
     mov   }qlo,     {qf
     seq   {qf,      >qf
     djn.f qlo,      >qf

;--- the paper. Initially designed for a p-spacer. ---
dest1 equ 174
dest2 equ 65

plch:	spl 1,{0
	spl *2,{0
paper:	spl @0,<dest1
	mov }-1,>-1
	mov {-2,{1
	djn.f *dest2,<dest2-4
end Qs
