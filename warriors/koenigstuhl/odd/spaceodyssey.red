;redcode
;name 2520: A Space Odyssey
;author Lukasz Adamowski
;assert 1

start
vamp spl #-1105, #1105
add $-1, $teeth
mov $teeth, @teeth
jmp $-2, $vamp
dat $0, $0
dat $0, $0
dat $0, $0
dat $0, $0
dat $0, $0
teeth jmp $pit, $0
pit spl $1, {vamp-5
mov $vamp-5, {vamp-1
mov $vamp-5, {vamp-1
jmp $-3, {vamp-5

end start

