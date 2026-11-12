;redcode-tinylp
;name Master of the Wins
;author Christian Schmidt
;strategy one strategy for the evolvers
;strategy three strategies for the handcoders
;strategy seven strategies for the optimizers
;strategy and one tiny warrior to beat them all!!!
;assert 1

;optimax 1234
;optimax work tlp-master
;optimax rounds 1 200 250 250
;optimax suite fshtinylp

;optimax phase2 fshtinylp/pap/silklander.red
;optimax phase2 100

;optimax phase3 top20
;optimax phase3 pap:scn
;optimax phase3 208

;optimax phase4 top20
;optimax phase4 100%

qGo  sne.x qf+592,   qf+656 ; scan
     seq.x qf+176,   qf+752
     djn.f @qlo+1,   @qlo+1
     sne.x qf+500,   qf+475
     seq.x qf+700,   }qf
     jmp   @qlo+1,   {qf
     sne.x qf+550,   qf+125
     jmz.f boot,      <qf

qf:  mul.x #300,     #625   ; decode
     jmz.f @qlo+1,   >qf

qlo: mov   {201,     >qf    ; 519 attack
     mov   }qlo,     {qf
     seq   {qf,      >qf
     djn.f qlo,      >qf


bStep   equ     695
sStep	  equ	    637
pAwa	  equ	    144

boot    mov     Stone+2, {bptr
        mov     Stone+1, {bptr
        mov     Stone,   {bptr
bptr    spl     275,     }692
        add.a   #bStep,   bptr
        djn.f   boot,    {679

        for     20
        dat     0, 0
        rof


Stone   mov    	{295,1-sStep
        sub.x  	#sStep   ,-1
        jmp    	-2       ,}-2

end     qGo