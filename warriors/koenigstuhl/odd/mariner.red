;redcode-DS
;name Mariner
;n-ame Herbal Avenger
;author Michal Janeczek
;kill Viking
;assert 1

org gate

cptr mov bomb , }2669
gate mov bomb , >cptr
scan seq 2454 , 2448
mov.b scan , cptr
add inc , scan
jmn gate , @gate
inc spl #2446 , 2446
mov @1 , }gate
djn -1 , <2
dat 11 , -100
spl #11 , -100

for 4
dat 0 , 0
rof

bomb spl #1 , 1


