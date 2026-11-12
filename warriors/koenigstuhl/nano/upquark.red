;redcode-NW
;name up quark
;author Christian Schmidt
;strategy Nano paper based on an idea by Herve Lepaisant
;strategy but with additional bomb line
;assert 1

;optimax 1234
;optimax work nano-master2
;optimax rounds 1 100 200 200
;optimax suite fsh94nop0.3

;optimax phase2 fsh94nop0.3/cds/herbal.red
;optimax phase2 40

;optimax phase3 top20
;optimax phase3 cds:scn:clr
;optimax phase3 50

;optimax phase4 top20
;optimax phase4 100%

pStep1  equ     1685
bStep1  equ     6251
bStep2  equ     4777
bStep3  equ     1110

boot	spl     1,       {bStep1
copy	spl     pStep1,  #0
	mov.i   >copy,   }copy
bomb    mov.i   {bStep2, {bStep3
	jmp     boot,    <copy	
end     boot

