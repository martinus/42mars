;redcode
;name Trinity2
;author Matt Hastings
;assert 1

start mov s1,300
mov s2,300
mov s3,300
arb mov s4,300
mov s5,300 
arb2 mov s6,300
mov s7,300
mov b1,arb2+300+5
mov b1,arb2+300+3
mov rm,arb+300-2584
mov ro,arb+301-2584
mov r1,arb+302-2584
mov r2,arb+303-2584
mov r3,arb+304-2584
mov r4,arb+305-2584
mov t1,arb2+324
mov t2,arb2+325
jmp start+300
dat #0,#0
s1 add 3,1
s2 mov <-2587-1, +2585-1
s3 djn -2,#998
s4 spl -2584,+2584
s5 spl 0,-1
s6 mov 5,<4
s7 jmp -1,0
b1 dat #0, #-5
rm spl 0,0
ro mov       3,      @3
r1 add       3,     3  
r2 jmp      -2,     0
r3 jmp      rm+2584+2+24+948+4, -4-948
r4 dat    #948,   #-948
t1 spl 0,0
t2 jmp -1,0

