;redcode-94
;author Compudemon
;name death
;assert 1

pin 1234

prime1 equ 19

begin ldp      #0, #0
 stp.b begin, #1
clone ldp      #1, #0
 seq.b begin, clone
 jmp   itsme, 0
 jmz.b  loss, begin
 djn.b     2, begin
 jmp win
 djn.b first, begin
 jmp tie

first   dat -1

loss ldp    #404, #0
 seq.ab #440, -1
 jmp try
 spl 1
 spl 1
 spl 2
 dat 0
bomb djn.f 0, <-100

try spl tie
 jmp win

tie spl          #0, #-1
 mov        bomb, @-1
 add   #5*prime1, -2
 djn.f        -1, <-100

itsme   ldp   #404, #0
 jmz.b  die, itsme
 stp     #0, #404
 jmp #0
die stp     #440, #404
        dat      0, 300

win spl 1
 spl 1
 spl 1
paper spl #7*prime1, #0
 mov       >-1, }-1
 add.a     #13, paper
 jmp     paper, <paper

end begin

