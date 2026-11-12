;redcode-lp
;name End of Days
;author Christian Schmidt
;strategy 
;assert 1

;-----------------------------------------------------
step	equ	95
gate	equ	(sp-3)		; 365
dist	equ	(7+(401*10))	; 3517 + 140

sp	spl.b	#-step, -step
msm	mov.i	sm,	*(hit+2*step)
msp	mov.i	sp,	@msm
in	add.ab	#2*step, msm
hit	jmz.b	@in,	#0
clr	mov.i	cbomb,	>gate
	jmp.b	clr,	>gate-2667
	dat.f	$0,	$0		; Too lazy to remove bugs

here	dat.f	$0,	$0
sm	jmp.b	#1,	#1
cbomb	dat.f	$0,    $15

for 20
	dat.f	$0,	$0
rof

bptr	dat.f	#dist,	#dist+3
boot	mov.i	cbomb,	<bptr
	mov.i	sm,	<bptr
for 8
	mov.i	<here,	{bptr
rof
	spl.b	*bptr,	<-2000
	djn.b	#0,	#5
	jmp.b	sp,	<-2200


for 50
	dat.f	$0,	$0
rof

;----Replinator-------

l       equ     21;25
zofs    equ     6667;1971

bo1     equ     548;2638
bo2     equ     109;2649
color   equ     7293;4001

from    mov     #l,     #0
ploop   mov     {bo1,   {bo2
        add     {0,     }0
        mov     <from,  {to
        jmn     ploop,  from
        spl     >from,  }color
to      jmz     zofs,   *0

for 50
	dat.f	$0,	$0
rof

; ~~~~~~~~~~~~~~~~ P-SPACE BRAIN ~~~~~~~~~~~~~~~~~~~~~
;;           
STORE equ 456 ; state storage location
w1 equ from
w0 equ boot

think   ldp.a #0, inP
    ldp.a #STORE, table
    mod.ba *inP, table
    stp.b *table, #STORE
table   jmp    }0,  # 1236 ;  0: action   0 :   1   4   6
    spl #  w0,  # 1628 ;  1: action   0 :   3   4   8
    spl #  w0,  #  858 ;  2: action   0 :   0   4   3
    spl #  w1,  # 1627 ;  3: action   1 :   2   3   7
    spl #  w0,  #  676 ;  4: action   0 :   0   4   1
    spl #  w0,  #   70 ;  5: action   0 :   5   0  10
    spl #  w0,  # 1628 ;  6: action   0 :   3   4   8
    spl #  w1,  # 2257 ;  7: action   1 :   8   3   7
    spl #  w0,  #  813 ;  8: action   0 :   7   1   3
    spl #  w1,  # 2071 ;  9: action   1 :   4  13   1
    spl #  w0,  #   97 ; 10: action   0 :   6  13   7
    spl #  w0,  # 1425 ; 11: action   0 :   8  11   0
    spl #  w0,  # 1719 ; 12: action   0 :   3  11   9
    spl #  w0,  #  309 ; 13: action   0 :  10   1   9
    spl #  w1,  # 1628 ; 14: action   1 :   3   4   8

inP  spl #  w0,      13 
    spl #   0,      14 
    spl #   0,      15 

end think

