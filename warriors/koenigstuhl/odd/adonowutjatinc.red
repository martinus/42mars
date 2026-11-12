;redcode-94
;name Adonowutjatinc
;author CH
;strategy An obese scanner probably destined
;strategy for last place. But who cares? :-)
;assert CORESIZE==8000

goal    equ     4000
ball    equ     3004

lenth   equ     24      ;18 scanable by jmz and 20 scanable by seq
;one bombable by nearly anything and one bombable by dats only
step    equ     4293

org scan

a equ 21 ;lost original values
b equ 0
c equ 0

for a
jmp #0, #ball                  ;just in case someone scans here
rof
dat 0, 0
for b
jmp #0, #ball
rof
dat 0, 0
for c
jmp     #0,     #ball
rof
for 55-2
dat     0,      0
rof
wait    djn.a   #0,             @clr
inc     add     #step,  @scan
scan    jmz.f   inc,            @ptr
slt     #0-lenth,       ptr
mov.f   @scan,  dir
spl     wait,           }dir
jmn     clr,            ptr
sub.f   #1,             2
spl     #0,             #0
clr     mov     bomb,           >dir
jmn.a   clr,            @-1
dat     goal,           0
jmp     0,              ptr
bomb    jmp     #0,             #0
dir     spl     #0,             #0
seq.x   -4,             >4
jmp     -1
mov.b   2,              3
mov     -7,             <2
        jmp     -1,             5
        jmp     -6,             -24
        jmp     -1
ptr     dat     14,             step
end

