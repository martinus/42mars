;redcode
;name A Trick Of The Tail
;author Lukasz Adamowski
;assert 1

n EQU 11
sstp EQU (CORESIZE-CORESIZE%(n+1))/(n+1)
offset EQU 3000

ptr1 dat 0, 10
bmb2 spl #-1, #-10
        dat 0, 0
start spl #0, #0
mov bmb1, >ptr1
mov *3, <ptr2
jmp -1, <ptr2
dat 0, -10
ptr2 dat bmb2, -10
bmb1 dat 0, 10

strp spl #offset, #ptr1
mov 2, }-1
mov 1, }-2
dat 1, 1

qvmp
x FOR n
mov $sbmb, $strp-x*sstp
ROF

spl 1
mov >strp, }strp
mov >strp, }strp
mov >strp, }strp
mov >strp, }strp
mov >strp, }strp
jmp strp+offset+start-ptr1

sbmb spl $sstp, {1

FOR (MAXLENGTH-CURLINE)/13
dat 13, -13
spl #0, {4
jmz 2314, 2341
cmp <908, >762
dat -1, 1
mov *0, *2667
djn #0, <-1
dat -3, 333
ldp #0, $4
jmp -2, }100
dat -13, 13
stp -333, #333
add $47, $-1000
ROF

end qvmp

