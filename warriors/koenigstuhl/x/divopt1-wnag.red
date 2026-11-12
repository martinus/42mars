;redcode-94x
;name Comb Scan X 47
;author Steve Gunnell
;strategy Reducing step scan seguing to a d-clear.
;assert 1

; Constants being played with by the optimizer
STEP    equ     6982
DIVS    equ     (39+2)
STOP    equ     1
OFFS    equ     33912
SAFE    equ     (bomb-bptr+4)
SCNT    equ     0
IMPNUM	equ		30901
HOP		equ		(5+134+0)
GAP1	equ		134
GAP2	equ		46

bptr    dat.f  $0        ,$0
        dat.f  $0        ,$0
ptr     dat.f  STEP     ,OFFS
	for GAP1
        dat.f  $0        ,$0
	rof
clear   spl    #0       ,>ptr
        mov.i  clrb     ,>ptr
        djn.f  -1       ,>ptr
        dat.f  $0        ,$0
clrb    dat <IMPNUM, HOP
	for GAP2
        dat.f  $0        ,$0
	rof
setb    mov.b  ptr      ,bptr
trash   mov.i  bomb     ,>bptr
for SCNT
        mov.i  bomb     ,>bptr
rof
        jmn.f  trash    ,@bptr
step    add.ab ptr      ,ptr
enter   jmz.f  step     ,@ptr
        slt.b  ptr      ,#SAFE
        jmp    setb
chop    div.a  #DIVS    ,ptr
        add.ab #bomb-ptr+2 ,ptr
        djn.b  step     ,#STOP
        jmp    clear
bomb    spl    #0       ,}0

end enter

