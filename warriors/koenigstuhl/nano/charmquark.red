;redcode-NW
;name charm quark
;author Christian Schmidt
;strategy Nano paper based on an idea by Herve Lepaisant
;strategy but with additional silk-imp
;assert 1

;optimax 1234
;optimax work nano-master5
;optimax rounds 1 100 200 200
;optimax suite fsh94nop0.3

;optimax phase2 fsh94nop0.3/cds/herbal.red
;optimax phase2 40

;optimax phase3 top20
;optimax phase3 cds:scn:clr
;optimax phase3 40

;optimax phase4 top20
;optimax phase4 100%

pStep1  equ     6278
bStep1  equ     36
bStep2  equ     280
bStep3  equ     1423

boot	spl     1,       {bStep1
copy	spl     pStep1,  #0
	mov.i   >copy,   }copy
	jmp     boot,    <copy	
        mov.i   #bStep2, }bStep3
end     boot

