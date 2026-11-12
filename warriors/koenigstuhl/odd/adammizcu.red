;redcode-94
;name Adam/Mizcu
;author Adam/Mizcu
;strategy p-warrior teamplay
;strategy for IRC21
;assert 1

org     think

;-----------Lukasz Adamowski--------------------------

start2	spl	1
	mov	-1,	0
	spl	1
	spl	$9*11*13,	$0
	mov	>-1,	}-1
	spl	$7*8*9,	$0
	mov	>-1,	}-1
	mov	>1,	{-1
	djn.f	$-1,	}1


;-------------Mizcu--------------------------

step equ 1143
step1 equ 7629
step2 equ 2021
step3 equ 4247
const equ 3400

pap: djn.b 0, #4
spl 1, <-111
spl 1, <-222
spl 1, <-333

spl @0, >step1
mov.i }-1, >-1
spl @0, >step2
mov.i }-1, >-1
mov.i 3, <const
mov {-3, <1
jmp @0, <step3
dat <2667, <5334

for 10
dat $0, $0
rof

start: spl pap
spl #0, >1
mov.i imp, imp
add.a #step+1, 1
jmp imp+step+1, 0
imp mov.i #step, *0


;----------------p-Switcher--------------------------


STORE   equ     250
w0      equ     start2
w1      equ     start


        dat     0,           0
in      dat     0,           10
boot    dat     0,           9
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