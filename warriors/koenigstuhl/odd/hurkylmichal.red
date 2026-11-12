;redcode-94
;name Hurkyl/Michal
;author Hurkyl/Michal
;strategy p-warrior teamplay
;strategy for IRC21
;assert 1

org     think

STORE   equ     250
w0      equ     boot
w1      equ     src

;---------------David Houston-------------------------

smod	equ	3

step	equ	(3 * 47)
brun	equ	3460

stream	equ	-3000

bdist	equ	5000

stone	spl	#step * 2, step * 2
	mov	- (brun * step), - ((brun - 1) * step)
	mov	step, *-1
	add.f	stone, -2
	djn.f	-3, <stream
bomb	dat	>-1, >1

	dat	{1, <1

	for	4
	dat	#1, >1
	dat	>1, #1
	dat	}1, >1
	dat	>1, }1
	rof

boot	mov	bomb, stone + 2 + step + bdist
	for	5
	mov	<bptr, {bptr
	rof
bptr	jmp	stone + bdist + 5, stone + 5


;---------------Michal Janezcek-------------------------

       SUB.X  $     2, $   -18      ; 5
scan   SNE.F  *   -19, @   -19
       SUB.F  #   -10, $   -20
       JMZ.F  $    -3, @   -21
       JMN.F  $   -16, <   -22
       SPL.B  *     1, >  1234      ; 13
       SPL.B  *     1, >  2345
       SPL.B  $     1, }     0
       SPL.B  $     1, >  3456
       SPL.B  @     0, >  2359
       MOV.I  }    -1, >    -1
       SPL.B  @     0, >  3201
       MOV.I  }    -1, >    -1
       MOV.I  $     4, >  1529
       MOV.I  $     3, >  -727
       MOV.I  {    -4, <     1
       DJN.B  @     0, <  2899
       DAT.F  <  2667, < -2666
src    mov        ptr, scan-19
       mov    {   src, <   dst
       mov    {   src, <   dst
       mov    {   src, <   dst
       djn    -2, #2
dst    jmp       scan,  scan-9
       DAT.F  $     1, $    14     ; 5
       SPL.B  #   106, $    14
       MOV.I  *    -2, >    -7
       MOV.I  *    -3, >    -8
       DJN.F  $    -2, }    -3
ptr    dat   142, 142

;----------------p-Switcher--------------------------

        dat     0,           0
in      dat     0,           10
        dat     0,           9
        dat     0,           11

think   ldp.a   #0,          in
        ldp.a   #STORE,      table
        mod.ba  *in,         table
        stp.b   *table,      #STORE
table   jmp     }0,          226
        dat     w0,          650
        dat     w0,          101
        dat     w0,          886
        dat     w0,          653
        dat     w0,          104
        dat     w1,          889
        dat     w1,          656
        dat     w1,          107
        dat     w1,          630
        dat     w1,          226

        end