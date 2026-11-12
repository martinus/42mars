;redcode-t Triple Challenge
;author Joshua Hudson
;name X-Shot TC
;strategy oneshot
;assert 1

SPL #3
ADD #10, 1
JMZ -1, 99
SPL #6, 6
MOV.I *-4, >-2
DJN -1, <-9
DAT 5
end 1
