
load('./ttool.js');
load('./tbase.js');
load('./ttemplate.js');
load('./tmid.js');


function load(path) {
	console.log("\n------------------------", path);
	require(path);
}