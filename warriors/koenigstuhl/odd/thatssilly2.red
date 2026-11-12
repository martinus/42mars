;redcode
;name That's silly 2
;author Lukasz Adamowski
;assert 1

boot mov start, start+CORESIZE/2+4
FOR 5
mov }boot, >boot
ROF
spl start+CORESIZE/2+4
start spl #0, <boot-4
mov 3, <boot-4
mov 2, <boot-4
jmp -3, <boot-4

end boot
