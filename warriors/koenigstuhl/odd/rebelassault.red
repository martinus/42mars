;redcode
;name Rebel Assault
;author Lukasz Adamowski
;assert 1

start spl $1, $0
spl $1, $0
spl @0, CORESIZE*100/314
mov }-1, >-1
jmn.a $-1, @-2
dat $0, $0

end start

