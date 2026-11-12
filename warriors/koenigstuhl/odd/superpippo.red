;redcode-94t
;name Superpippo
;author LAchi
;strategy Super Goof
;strategy Includes Paperinik (tuned by Sascha Zapf) and Pi-stone
;strategy and some P-optimizations found here and there.
;       CORESIZE == 8192
;assert 1

;P-space things
	PIN 768
_STR    equ     #94    ;Not that obviously

	org think

;
; Paperinik - Tuned by Sascha
;
PSTEP1 equ 767
PSTEP2 equ 657

bootdis equ 4096

start
	spl 1, <1538
	spl 1, <7465
	spl 1, <6425

	mov.i	<boo,{boo
boo jmp		ptr1+8+bootdis,ptr1+8
paperinik
ptr1
	spl @0, }PSTEP1
	mov }ptr1, >ptr1
	mov.i   pbomb1,  >7128   ;bombing
	mov.i   pbomb ,  }4512   ;A-indirect bombing
	mov {ptr1, <ptr2
ptr2
	jmp @0, >PSTEP2
pbomb
	dat.f   >2731,  >5462   ;anti-imp bomb
pbomb1
	dat     >1,     }1      ;anti clear and djn stream bomb


;
; P-Switcher (from Gem of the Ocean)
;

parray    dat 0,start       ; table for pswitching
          dat 0,boot        ; - stay after win
          dat 0,start       ; - go to ptie after tie
          dat 0,boot        ; - move up one after loss
          dat 0,start
          dat 0,boot
ptie      dat 0,slSweep
          dat 0,boot

think
presult   ldp.ab #0,#0        ; pswitch code, nice and short
pselect   ldp.ab _STR,#0
          sne.ab #0,presult   ; advance table selection after a loss
          add.ab #1,pselect
          sne.ab #2,presult   ; go to Sweep after a tie
          mov    #ptie-parray,pselect
          stp.ba pselect,pselect
          mod.ab #presult-parray,pselect
          add.ba pselect,pchoice
pchoice   jmp    @parray,{pselect       ; jump to selection

;
;Pi-Stone
;

;boot location
away    equ     4096    ;+- 3000 locations

STEP1 equ 113
STEP2 equ 118
STEP3 equ 124

PROG1 equ STEP1
PROG2 equ PROG1+STEP2
PROG3 equ PROG2+STEP3

;boot the bomber away
boot
;non dimenticar...
		mov.i bomb, pbomb1
        mov     *tptr,  @tptr
        mov     {tptr,  <tptr
        mov     {tptr,  <tptr
        mov     {tptr,  <tptr
        mov     {tptr,  <tptr
        mov     {tptr,  <tptr
        mov     {tptr,  <tptr
        mov     {tptr,  <tptr
        mov     {tptr,  <tptr
        mov     {tptr,  <tptr
        mov     {tptr,  <tptr
;mai perdere l'occasione!
        jmp     >tptr, {start-(3*MINDISTANCE)
tptr    dat     bomb,   away+bomb


;tornado-style bomber

bomber
	mov.i bomb1, *ptr
	mov.i bomb2, @ptr
ptr
	mov.i PROG1+bomb,@PROG2+bomb
	add.f steps,ptr
	djn.f bomber, {bomber-(3*MINDISTANCE)

;something like a coreclear w/ djn.f backstream

steps
	spl #PROG3, #PROG3
	mov.i -12, }bomber+1
	mov.i -13, }bomber+1
	djn.f -1, {bomber-1
bomb2
	djn.f steps-ptr, {STEP3
bomb
bomb1
	dat.f {0,<0

;
; Sweep from Gem Of the Ocean
;

;better booting
slSweep
;non dimenticar...
		mov.i bomb, pbomb1
        mov     @btSweep,  *btSweep
        mov     <btSweep,  {btSweep
        mov     <btSweep,  {btSweep
        mov     <btSweep,  {btSweep
        mov     <btSweep,  {btSweep
          add.a  #1,btSweep
btSweep   jmp    Sweep+3+4096,Sweep+3

          dat    #-5     ,8
Sweep     spl    #6050   ,150
          mov    @2,>Sweep-4
          mov    @1,>Sweep-4
          djn.b  -2,{Sweep

	end

