;redcode-94
;name If you can't be subtle
;author Ilmari Karonen
;strategy Jedimp's own qscan shortened and reversed, followed by mini-HSA.
;assert CORESIZE == 8000
; KOFACOTO-1

org start

step equ 12             ; gap between qbombs
strafelen equ 4         ; coverage area = step*strafelen*3

bomb    dat <1, step
qstep	dat -step, 2*step

DEAD	equ (bomb-1)

;*************** QSCAN

qs    equ   10

QS1   equ   (-100)
QS2   equ   (3*QS1)
QS3   equ   (6*QS2)
QBASE equ   (tab-300+QS1)

SIG01 equ   a01
SIG02 equ   {a01
SIG03 equ   }a01
SIG04 equ   >a01
SIG05 equ   <a01
SIG06 equ   a01

start   seq     QBASE+QS2*0+QS1*0, QBASE +QS2*0 +QS1*0+QS3
        jmp     aaa,  SIG01
        seq     QBASE+QS2*1+QS1*0, QBASE +QS2*1 +QS1*0+QS3
        jmp     a01,  SIG02
        seq     QBASE+QS2*2+QS1*0, QBASE +QS2*2 +QS1*0+QS3
        jmp     a01,  SIG03
        seq     QBASE+QS2*3+QS1*0, QBASE +QS2*3 +QS1*0+QS3
        jmp     aaa,  SIG04
        seq     QBASE+QS2*4+QS1*0, QBASE +QS2*4 +QS1*0+QS3
        jmp     aaa,  SIG05
        seq     QBASE+QS2*5+QS1*0, QBASE +QS2*5 +QS1*0+QS3
        djn.f   a01,  SIG06

        seq     QBASE+QS2*0+QS1*1, QBASE +QS2*0+QS1*1+QS3
        jmp     a02,  SIG01
        seq     QBASE+QS2*1+QS1*1, QBASE +QS2*1+QS1*1+QS3
        jmp     a02,  SIG02
        seq     QBASE+QS2*2+QS1*1, QBASE +QS2*2+QS1*1+QS3
        jmp     a02,  SIG03
        seq     QBASE+QS2*3+QS1*1, QBASE +QS2*3+QS1*1+QS3
        jmp     a02,  SIG04
        seq     QBASE+QS2*4+QS1*1, QBASE +QS2*4+QS1*1+QS3
        jmp     a02,  SIG05
        seq     QBASE+QS2*5+QS1*1, QBASE +QS2*5+QS1*1+QS3
        djn.f   a02,  SIG06

;        seq     QBASE+QS2*0+QS1*2, QBASE+QS2*0+QS1*2+QS3
;        jmp     a03,  SIG01
;!        seq     QBASE+QS2*1+QS1*2, QBASE+QS2*1+QS1*2+QS3
;!        jmp     a03,  SIG02
;        seq     QBASE+QS2*2+QS1*2, QBASE+QS2*2+QS1*2+QS3
;        jmp     a03,  SIG03
;        seq     QBASE+QS2*3+QS1*2, QBASE+QS2*3+QS1*2+QS3
;        jmp     a03,  SIG04
;        seq     QBASE+QS2*4+QS1*2, QBASE+QS2*4+QS1*2+QS3
;        jmp     a03,  SIG05
;        seq     QBASE+QS2*5+QS1*2, QBASE+QS2*5+QS1*2+QS3
;        djn.f   a03,  SIG06

        jmp     hsaboot          ;nothing found

        dat     1*QS2,  4*QS2+QBASE-ptr
tab     dat     0*QS2,  0*QS2+QBASE-ptr
        dat     2*QS2,  3*QS2+QBASE-ptr

a03     add     #QS1,   @a01
a02     add     #QS1,   @a01
a01     add.ab  tab,    tab
aaa     mov.ba  @a01,   ptr

        sne     DEAD,   *ptr  ;which of the two?
        add.a	#QS3,   ptr

	add.ab	ptr,	ptr

qbrun   mov 	bomb, 	@ptr
	mov 	bomb, 	*ptr
ptr     mov 	-0, 	@step
	add.f	qstep, 	-1
        djn     qbrun,  #strafelen
	jmp	hsaboot



hsastep EQU 9
hsaptr EQU (hsabomb-13)
hsaaway EQU 3000

hsabomb: spl    #1,{1
hsakill: mov    hsabomb,<hsaptr
hsamptr: mov    >hsaptr,>hsaptr
         jmn.f  hsakill,>hsaptr
hsaa:    add    #hsastep+1,@hsamptr
hsascan: jmz.f  hsaa,<hsaptr
         slt    @hsamptr,#hsabtm-hsaptr+3
         djn    hsakill,@hsamptr
         djn    hsaa,#16
hsabtm:  jmp    hsaa,{hsakill

hsaboot: mov    hsabtm,@hsadest
hsaN FOR 8
         mov    hsabtm-hsaN,<hsadest
ROF
         spl    @hsadest,1
hsadest: mov    #250,@hsaaway
         mov    hsabomb,<hsadest
         div.f  #0,hsadest

      end

