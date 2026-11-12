;redcode-94
;name Evil Jedimps
;author John K W
;strategy Jedimp for KOFACOTO Round 4
;assert 1

org start

d2    equ 1143;2667
TSTEP equ 3120;1751
bstep equ 2365;1819 ;2283 ;1997
boot  equ 1700-(80+15)*4-1

start	spl     1
        spl     1
        spl	e4
        spl     1
        mov     <b,	{b
b:	jmp     boot,   imp2+1
evol:   spl     @evol,  }TSTEP
        mov.i   }evol,  >evol
evoli:	spl	#d2,	bstep-1
        mov     bomb,	>2
        add.f   evoli,  j
j:      jmp.f   imp2-(d2+1), {-4+bstep
bomb	dat	{1,	{2
imp2    mov.i   #d2,	*0

for 75
dat 0,0
rof

d    equ 2667

e4:	spl	#d,	bstep-1
        add.f   e4,	1
	jmp.f   imp-(d+1), {-4+bstep
imp	mov.i   #d,	*0
end

--------

;redcode-94
;name C I A
;kill C I A
;author Anders Ivner
;assert (CORESIZE == 8000)
;strategy .5c bomber with intelligence bombs

STEP    equ     3119
A       equ     (c-1)
BOFF    equ     2500
SPYOFF  equ     STEP*1400

eye     equ     (A-SPYOFF)
spy     equ     (A+SPYOFF)
bomber  equ     (b0+BOFF)

        org     boot

bpt     dat     bomber-11,bomber
bpt2    dat     (spy+BOFF),0
boot    mov     b0,     @bpt
        mov     {boot,  <bpt
        mov     {boot,  <bpt
        mov     {boot,  <bpt
        mov     {boot,  <bpt
        mov     {boot,  <bpt
        mov     {boot,  <bpt
        mov     {boot,  <bpt
        mov     {boot,  <bpt
        mov     cb,     *bpt
        mov     {-1,    {bpt
        mov     #2000,  {bpt
        mov     spy0,   *bpt2
        spl     @bpt
        mov.f   #0,     bpt
        mov.f   #0,     bpt2

        dat     -1,     15
cb      spl     #-2,    15

start   spl     #0,     <-50
loop    add     c,      @ip
ip      mov     @ip,    @spy
        mov     @ip,    *spy
        jmz.b   loop,   eye
c       spl     #STEP,  <-STEP
        mov     @2,     >b0-13
        mov     @1,     >b0-13
b0      djn.b   -2,     {b0-11

spy0    dat     <-SPYOFF,       <-SPYOFF

i       for     MAXLENGTH-CURLINE
        spl     #i*17,  i*11
        rof

        end

