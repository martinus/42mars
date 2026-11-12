;redcode-rf23
;name UV-Scorch
;author G.Labarga
;assert 1
;strategy jumping stun bomber or paper/stone
;strategy Bah, not too good

	STRAT1 equ loop
	STRAT2 equ stopap
	D_STATE equ 3335
	D_RESULT equ 0

;----- paper/stone -----
where equ 24990	;9700
pstep equ -105 ;(2000)
bstep1 equ (503*2)	;1006/2012/4024/8048/16096
bstep2 equ (383*2)	;766/1532/3064/6128/12256

ptr:	mov.ab #8,#8
	add.a #pstep,dst
copy:	mov <ptr,{dst
	mov.i {bstep1,{bstep2
	add.f {0,}0
	jmn copy,ptr
	spl @ptr ;,>-2400
dst:	jmz.b where,*0
for 20
	dat 0,0
rof
stopap:	spl copy
	jmp copy2
for 20
	dat 0,0
rof
ptr2:	mov.ab #8,#8
	add.a #-pstep,dst2
copy2:	mov <ptr2,{dst2
	mov.i {bstep1,{bstep2
	add.f {0,}0
	jmn copy2,ptr2
	spl @ptr2 ;,>-2400
dst2:	jmz.b -where,*0

for 50
	dat 0,0
rof
;----- P-brain -----
start:	LDP.A #D_RESULT,RESULT
	LDP.BA 2,STATE
	MOD.BA *RESULT,STATE
	STP.B *STATE,#D_STATE
STATE:	JMP }0,36		;initial state
TABLE:	dat STRAT1,128		;state1
	dat STRAT1,108		;state2
	dat STRAT2,19		;state3
	dat STRAT2,55		;state4
	dat STRAT2,139		;state5
	dat STRAT2,35		;state6

RESULT:	dat 0,5
	dat 0,4
	dat 0,7
for (MAXLENGTH-CURLINE)-13
	dat 0,0
rof

;----- Jumping bomber -----
where3 equ 11800

ptr3:	mov #13,#13
setp:	mov #12000,ref
	djn loop,#160
	nop gap,{loop	;jmp/dat bomb switch
loop:	mov bm,@ref
ref:	mov *-1,}12000
gap:	add.ab 2,ref
	jmn *ref,ref	;-2,-2
copy3:	mov <ptr3,{dst3	;-8,2
	jmn copy3,ptr3
dst3:	jmp where3
	dat >3,}1
bm:	jmp #4,>-81

end start


